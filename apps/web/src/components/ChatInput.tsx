import React, { useState } from 'react';

interface ChatInputProps {
  disabled?: boolean;
  onSend: (text: string) => void;
}

/**
 * Chat input component. Provides a textarea that grows with content and
 * submits the message when Enter is pressed without Shift. The send
 * button can also be clicked to submit.
 */
const ChatInput: React.FC<ChatInputProps> = ({ disabled, onSend }) => {
  const [value, setValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim().length > 0 && !disabled) {
        onSend(value.trim());
        setValue('');
      }
    }
  };

  const handleClick = () => {
    if (value.trim().length > 0 && !disabled) {
      onSend(value.trim());
      setValue('');
    }
  };

  return (
    <div className="p-4 border-t border-border bg-chatBg">
      <div className="relative flex items-end">
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Type your message..."
          className="flex-1 resize-none bg-inputBg text-white placeholder-gray-400 border border-border rounded-md py-3 px-4 focus:outline-none focus:ring-1 focus:ring-assistant/50 pr-12"
          disabled={disabled}
        />
        <button
          onClick={handleClick}
          disabled={disabled || value.trim().length === 0}
          className="absolute right-2 bottom-2 text-gray-300 hover:text-white disabled:opacity-40"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path d="M2.94 2.94a.75.75 0 011.06 0l13 13a.75.75 0 01-1.06 1.06L2.94 4a.75.75 0 010-1.06z" />
            <path d="M6.75 11.25a.75.75 0 011.06 0L15 18.44a.75.75 0 01-1.06 1.06L6.75 12.31a.75.75 0 010-1.06z" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">Press Enter to send, Shift+Enter for new line</p>
    </div>
  );
};

export default ChatInput;