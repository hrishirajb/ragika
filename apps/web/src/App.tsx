import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import type { Citation } from '@ragika/shared';

type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
  citations?: Citation[];
}

export interface ChatMeta {
  id: string;
  title: string;
  messages: Message[];
}

/**
 * Main application component. Handles management of multiple chats and
 * communicates with the backend API to submit queries and receive answers.
 */
const App: React.FC = () => {
  // Persist chats in local storage so conversations survive refresh
  const [chats, setChats] = useState<ChatMeta[]>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('ragika-chats');
      if (saved) {
        try {
          return JSON.parse(saved) as ChatMeta[];
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  // Currently selected chat ID (null means no chat yet)
  const [currentChatId, setCurrentChatId] = useState<string | null>(
    chats.length > 0 ? chats[0].id : null
  );
  // Update local storage whenever chats change
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ragika-chats', JSON.stringify(chats));
    }
  }, [chats]);

  // Create a new chat
  const handleNewChat = () => {
    const id = uuidv4();
    const newChat: ChatMeta = {
      id,
      title: 'New Chat',
      messages: []
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(id);
  };

  // Select an existing chat from sidebar
  const handleSelectChat = (id: string) => {
    setCurrentChatId(id);
  };

  // Send a user message and get assistant response
  const handleSendMessage = async (content: string) => {
    if (!currentChatId) {
      // If no chat exists, create one implicitly
      handleNewChat();
      return;
    }
    // Append user message
    setChats(prev =>
      prev.map(chat => {
        if (chat.id !== currentChatId) return chat;
        const userMessage: Message = {
          id: uuidv4(),
          role: 'user',
          content
        };
        return {
          ...chat,
          messages: [...chat.messages, userMessage]
        };
      })
    );
    try {
      // Call API for answer
      const response = await axios.post<{
        answer: string;
        citations: Citation[];
      }>(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/chat/query`,
        {
          query: content
        }
      );
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: response.data.answer,
        citations: response.data.citations
      };
      // Append assistant message
      setChats(prev =>
        prev.map(chat => {
          if (chat.id !== currentChatId) return chat;
          return {
            ...chat,
            messages: [...chat.messages, assistantMessage]
          };
        })
      );
    } catch (err: any) {
      console.error(err);
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: 'Error: unable to retrieve response from server. Please try again later.'
      };
      setChats(prev =>
        prev.map(chat => {
          if (chat.id !== currentChatId) return chat;
          return {
            ...chat,
            messages: [...chat.messages, assistantMessage]
          };
        })
      );
    }
  };

  const currentChat = chats.find(c => c.id === currentChatId) || null;

  return (
    <div className="flex h-screen bg-chatBg text-white">
      <Sidebar
        chats={chats}
        currentChatId={currentChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
      />
      <ChatWindow
        chat={currentChat}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
};

export default App;