import React from 'react';
import { Chat } from '../types';
import { Radio, Users, Bookmark, Pin } from 'lucide-react';
import { TelegramAvatar } from './TelegramAvatar';
import { realtimeNetwork } from '../services/realtimeNetwork';

interface ChatRowProps {
  chat: Chat;
  onClick: () => void;
  isActive?: boolean;
}

export const ChatRow: React.FC<ChatRowProps> = ({ chat, onClick, isActive }) => {
  const isSavedMessages = chat.id === 999999 || chat.isSavedMessages;
  const isOnline = chat.type === 'direct' && !isSavedMessages
    ? (chat.userId ? realtimeNetwork.isUserOnline(chat.userId) : chat.online)
    : false;

  return (
    <div
      onClick={onClick}
      className={`group flex items-center px-4 py-3 cursor-pointer select-none transition-colors relative ${
        isActive
          ? 'bg-sky-50 dark:bg-sky-950/40 border-l-4 border-sky-500'
          : 'hover:bg-gray-50 dark:hover:bg-zinc-800/60 active:bg-gray-100 dark:active:bg-zinc-800'
      }`}
    >
      {/* Telegram Avatar or Saved Messages Bookmark avatar */}
      {isSavedMessages ? (
        <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-sky-500 to-sky-400 text-white flex items-center justify-center shrink-0 shadow-sm ring-2 ring-sky-300/30">
          <Bookmark className="w-6 h-6 fill-white text-white" />
        </div>
      ) : (
        <TelegramAvatar
          src={chat.avatarUri}
          name={chat.name}
          id={chat.userId || chat.id}
          size="lg"
          isOnline={isOnline}
          showOnlineDot={chat.type === 'direct'}
        />
      )}

      {/* Content */}
      <div className="ml-3 flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {chat.type === 'channel' && (
              <Radio className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            )}
            {chat.type === 'group' && (
              <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            )}
            <span className="font-semibold text-[15px] text-gray-900 dark:text-zinc-100 truncate">
              {chat.name}
            </span>
            {chat.username && (
              <span className="text-xs text-sky-500 font-normal shrink-0">
                {chat.username}
              </span>
            )}
            {chat.streak && chat.streak.status === 'active' && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700/60 shadow-xs shrink-0">
                🔥 {chat.streak.streakCount}
              </span>
            )}
            {chat.streak && chat.streak.status === 'burned_out' && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] bg-gray-100 dark:bg-zinc-800 text-gray-400 shrink-0" title="Огонёк погас">
                💔 Погас
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 dark:text-zinc-500 shrink-0 ml-2">
            {chat.time}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-gray-500 dark:text-zinc-400 truncate flex-1">
            {chat.lastMessage || <span className="italic text-gray-400 dark:text-zinc-500">Нет сообщений</span>}
          </p>

          <div className="flex items-center gap-1.5 shrink-0">
            {chat.unread > 0 && (
              <span className="shrink-0 min-w-5 h-5 px-1.5 flex items-center justify-center bg-sky-500 text-white text-[11px] font-bold rounded-full shadow-xs">
                {chat.unread}
              </span>
            )}
            {(chat.isPinned || isSavedMessages) && (
              <Pin className="w-3.5 h-3.5 text-gray-400 rotate-45 shrink-0" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
