import React, { useEffect, useRef } from 'react';
import type { ChatMeta, Message } from '../App';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';

interface ChatWindowProps {
  chat: ChatMeta | null;
  onSendMessage: (text: string) => void;
}

/**
 * Primary chat view component. Displays the conversation history and
 * provides an input area at the bottom for sending new messages.
 */
const ChatWindow: React.FC<ChatWindowProps> = ({ chat, onSendMessage }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages: Message[] = chat?.messages || [];

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <main className="flex-1 flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-gray-400 text-sm mt-4 text-center">
            Start a conversation by typing a message below.
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            citations={msg.citations}
          />
        ))}
      </div>
      <ChatInput onSend={onSendMessage} disabled={!chat} />
    </main>
  );
};

export default ChatWindow;