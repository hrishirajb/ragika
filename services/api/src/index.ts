import fastify from 'fastify';
import cors from '@fastify/cors';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Import shared types for strong typing
import type {
  IngestTextRequest,
  IngestTextResponse,
  ChatQueryRequest,
  ChatQueryResponse,
  Citation
} from '@ragika/shared';

// Load environment variables from .env file
dotenv.config();

const app = fastify({ logger: false });

// Enable CORS for all origins; for production you may want to restrict this
app.register(cors, { origin: true });

// Environment configuration with sensible defaults
const PORT = Number(process.env.PORT) || 5000;
const EMBEDDINGS_BASE_URL = process.env.EMBEDDINGS_BASE_URL || 'http://localhost:8080';
const RERANK_BASE_URL = process.env.RERANK_BASE_URL || '';
const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://localhost:11434';
const LLM_MODEL = process.env.LLM_MODEL || 'llama3.1:8b-instruct';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'ragika';
const TOP_K = Number(process.env.TOP_K) || 20;
const MAX_CONTEXT = Number(process.env.MAX_CONTEXT) || 8;

/**
 * Ensure that the Qdrant collection exists. If it does not exist, create it
 * with the vector size expected by the chosen embedding model (BGE-M3 has
 * dimension 1024) and cosine distance. This function is idempotent.
 */
async function ensureCollection(): Promise<void> {
  try {
    await axios.get(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
    return;
  } catch (err) {
    // Collection does not exist – create it
    try {
      await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        vectors: {
          size: 1024,
          distance: 'Cosine'
        }
      });
    } catch (e) {
      console.error('Failed to create Qdrant collection', e);
      throw e;
    }
  }
}

/**
 * Split a large text into smaller chunks. This simple implementation
 * splits on whitespace into tokens, and accumulates them until a
 * threshold is reached. You may wish to refine this to use sentences
 * or paragraphs for more natural chunk boundaries.
 */
function chunkText(text: string, maxTokens = 500): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let count = 0;
  for (const word of words) {
    current.push(word);
    count++;
    if (count >= maxTokens) {
      chunks.push(current.join(' '));
      current = [];
      count = 0;
    }
  }
  if (current.length > 0) {
    chunks.push(current.join(' '));
  }
  return chunks;
}

/**
 * Call the embeddings service to convert text into embedding vectors.
 * Accepts an array of strings and returns an array of vectors. If the
 * underlying service errors, the exception will propagate to the caller.
 */
async function embedTexts(texts: string[]): Promise<number[][]> {
  try {
    const response = await axios.post(
      `${EMBEDDINGS_BASE_URL}/embed`,
      { inputs: texts },
      { timeout: 30000 }
    );
    // Most TEI endpoints return { embeddings: number[][] }
    if (response.data && Array.isArray(response.data.embeddings)) {
      return response.data.embeddings as number[][];
    }
    throw new Error('Invalid response from embeddings service');
  } catch (err: any) {
    console.error('Embedding request failed', err.message || err);
    throw err;
  }
}

/**
 * Optionally rerank contexts using a cross-encoder. If no rerank service
 * is configured, this function simply returns a sequence of indices in
 * descending order (i.e. preserves the original ranking).
 */
async function rerankContexts(query: string, contexts: string[]): Promise<number[]> {
  if (!RERANK_BASE_URL) {
    return contexts.map((_, idx) => idx);
  }
  try {
    const res = await axios.post(
      `${RERANK_BASE_URL}/rerank`,
      {
        query,
        texts: contexts
      },
      { timeout: 30000 }
    );
    if (res.data && Array.isArray(res.data.scores)) {
      // Convert scores to ordering (descending)
      const scores: number[] = res.data.scores;
      return scores
        .map((score, idx) => ({ score, idx }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.idx);
    }
    return contexts.map((_, idx) => idx);
  } catch (err) {
    console.error('Rerank request failed', err);
    return contexts.map((_, idx) => idx);
  }
}

/**
 * Generate an answer using the configured LLM provider. Supports Ollama
 * (ollama) and OpenAI-compatible (openai_compat) endpoints. The prompt
 * should already include any context and instructions needed by the model.
 */
async function generateAnswer(prompt: string): Promise<string> {
  if (LLM_PROVIDER === 'ollama') {
    try {
      const res = await axios.post(
        `${LLM_BASE_URL}/api/generate`,
        {
          model: LLM_MODEL,
          prompt,
          stream: false
        },
        { timeout: 300000 }
      );
      return res.data.response as string;
    } catch (err: any) {
      console.error('Ollama request failed', err.message || err);
      throw err;
    }
  }
  // Default to OpenAI-compatible API
  try {
    const res = await axios.post(
      `${LLM_BASE_URL}/v1/chat/completions`,
      {
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        top_p: 0.95
      },
      { timeout: 300000 }
    );
    if (res.data && res.data.choices && res.data.choices.length > 0) {
      return res.data.choices[0].message.content as string;
    }
    throw new Error('Invalid response from LLM provider');
  } catch (err: any) {
    console.error('LLM request failed', err.message || err);
    throw err;
  }
}

/**
 * Ingest text documents into the vector database. Splits the text into
 * manageable chunks, embeds each chunk, and upserts them into Qdrant.
 */
app.post<{ Body: IngestTextRequest }>('/ingest/text', async (request, reply) => {
  const { text, category, title } = request.body;
  if (!text || !category) {
    return reply.status(400).send({ error: 'text and category are required' });
  }
  try {
    await ensureCollection();
    const documentId = uuidv4();
    const chunks = chunkText(text, 500);
    const vectors = await embedTexts(chunks);
    const points = chunks.map((chunk, idx) => ({
      id: uuidv4(),
      payload: {
        documentId,
        category,
        text: chunk,
        title: title || ''
      },
      vector: vectors[idx]
    }));
    await axios.put(
      `${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true`,
      { points },
      { timeout: 60000 }
    );
    const response: IngestTextResponse = {
      documentId,
      chunks: points.length
    };
    return reply.send(response);
  } catch (err: any) {
    console.error('Ingest error', err.message || err);
    return reply.status(500).send({ error: 'Failed to ingest document' });
  }
});

/**
 * Handle chat queries. Performs vector search against Qdrant, optionally
 * reranks results, constructs a prompt with top contexts and invokes the
 * LLM to generate a grounded answer with citations.
 */
app.post<{ Body: ChatQueryRequest }>('/chat/query', async (request, reply) => {
  const { query, category } = request.body;
  if (!query) {
    return reply.status(400).send({ error: 'query is required' });
  }
  try {
    await ensureCollection();
    // Embed the query
    const [queryVector] = await embedTexts([query]);
    // Build filter if category provided
    let filter: any = undefined;
    if (category) {
      filter = {
        must: [
          {
            key: 'category',
            match: { value: category }
          }
        ]
      };
    }
    // Search in Qdrant
    const searchRes = await axios.post(
      `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`,
      {
        vector: queryVector,
        top: TOP_K,
        with_payload: true,
        with_vector: false,
        filter
      },
      { timeout: 60000 }
    );
    const hits: any[] = searchRes.data?.result || [];
    if (hits.length === 0) {
      const emptyResponse: ChatQueryResponse = {
        answer: "I'm sorry, I couldn't find any information relevant to your question.",
        citations: []
      };
      return reply.send(emptyResponse);
    }
    // Extract context texts
    const contexts = hits.map(hit => hit.payload.text as string);
    // Compute ordering via reranker if available
    const order = await rerankContexts(query, contexts);
    // Select top contexts
    const selectedIndices = order.slice(0, MAX_CONTEXT);
    const selectedContexts = selectedIndices.map(i => contexts[i]);
    const citations: Citation[] = selectedIndices.map(i => ({
      documentId: hits[i].payload.documentId as string,
      chunkId: hits[i].id.toString()
    }));
    // Prepare context string for prompt
    const contextString = selectedContexts.map((ctx, i) => `[${i + 1}] ${ctx}`).join('\n\n');
    // Compose prompt
    const prompt = `You are an institutional knowledge assistant. Use the context provided to answer the question. Respond in a concise and clear manner. Cite the source of your information using the bracketed numbers corresponding to the context. If you do not know the answer based on the context, say you don't know.\n\nContext:\n${contextString}\n\nQuestion: ${query}\nAnswer:`;
    // Generate answer via LLM
    const rawAnswer = await generateAnswer(prompt);
    const response: ChatQueryResponse = {
      answer: rawAnswer.trim(),
      citations
    };
    return reply.send(response);
  } catch (err: any) {
    console.error('Chat query error', err.message || err);
    return reply.status(500).send({ error: 'Failed to process chat query' });
  }
});

/**
 * Healthcheck endpoint to verify that the collection exists
 */
app.get('/healthz', async (_request, reply) => {
  try {
    await ensureCollection();
    return reply.send({ status: 'ok' });
  } catch {
    return reply.status(500).send({ status: 'error' });
  }
});

// Start the server
app.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
  console.log(`API server listening on port ${PORT}`);
}).catch(err => {
  console.error('Failed to start server', err);
});