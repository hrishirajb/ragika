import React from 'react';
import type { Citation } from '@ragika/shared';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

/**
 * Renders a single message bubble. Styles differ for user and assistant
 * messages. Citations are displayed as numbered links in the footer of
 * assistant messages.
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({ role, content, citations }) => {
  const isUser = role === 'user';
  return (
    <div className="w-full py-2">
      <div className={`max-w-3xl mx-auto flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
            isUser ? 'bg-user text-white' : 'bg-assistant text-white'
          }`}
        >
          <div>{content}</div>
          {!isUser && citations && citations.length > 0 && (
            <div className="mt-2 text-xs text-blue-400 space-x-1">
              {citations.map((_, idx) => (
                <a key={idx} href="#" className="underline">
                  [{idx + 1}]
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;