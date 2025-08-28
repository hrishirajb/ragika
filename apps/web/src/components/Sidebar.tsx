import React from 'react';
import type { ChatMeta } from '../App';

interface SidebarProps {
  chats: ChatMeta[];
  currentChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
}

/**
 * Sidebar component rendering the list of chats and a button to create a
 * new chat. The currently active chat is highlighted.
 */
const Sidebar: React.FC<SidebarProps> = ({ chats, currentChatId, onNewChat, onSelectChat }) => {
  return (
    <aside className="w-64 bg-sidebar flex flex-col border-r border-border">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <span className="font-semibold text-lg">RAGIKA</span>
        <button
          onClick={onNewChat}
          className="ml-2 px-3 py-1 rounded bg-assistant hover:bg-assistant/80 text-sm"
        >
          + New
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto">
        {chats.length === 0 && (
          <div className="p-4 text-sm text-gray-400">No chats yet. Start a new chat!</div>
        )}
        {chats.map(chat => (
          <div
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`cursor-pointer px-4 py-3 border-b border-border text-sm ${
              currentChatId === chat.id ? 'bg-inputBg' : 'hover:bg-assistant/20'
            }`}
          >
            <div className="truncate">{chat.title}</div>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;