import React from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Search } from 'lucide-react';
import { UserAccount } from '../types';
import { TelegramAvatar } from './TelegramAvatar';

interface TegeTopBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onMenu?: () => void;
  onSearch?: () => void;
  onCall?: () => void;
  onVideoCall?: () => void;
  onOptions?: () => void;
  onTitleClick?: () => void;
  accounts?: UserAccount[];
  currentAccountId?: number;
  onSwitchAccount?: (acc: UserAccount) => void;
}

export const TegeTopBar: React.FC<TegeTopBarProps> = ({
  title,
  subtitle,
  onBack,
  onMenu,
  onSearch,
  onCall,
  onVideoCall,
  onOptions,
  onTitleClick,
  accounts,
  currentAccountId,
  onSwitchAccount
}) => {
  const otherAccounts = accounts && currentAccountId
    ? accounts.filter((a) => a.id !== currentAccountId)
    : [];

  return (
    <header className="h-16 px-3 sm:px-4 flex items-center justify-between bg-white dark:bg-zinc-900 sticky top-0 z-30 shrink-0 select-none transition-colors">
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-full text-sky-500 hover:text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-zinc-800 active:scale-90 transition shrink-0 cursor-pointer touch-manipulation"
            aria-label="Назад"
            title="Назад"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
        ) : null}

        <div
          onClick={onTitleClick}
          className={`min-w-0 flex flex-col justify-center ${onTitleClick ? 'cursor-pointer hover:opacity-85 transition' : ''}`}
        >
          <h1 className="text-[22px] font-bold text-gray-900 dark:text-white truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-sky-500 dark:text-sky-400 font-medium truncate">
              {subtitle}
            </p>
          )}
        </div>

        {/* 1-Tap Quick Account Switcher Button (Directly in top bar) */}
        {otherAccounts.length > 0 && onSwitchAccount && (
          <div className="flex items-center gap-1.5 ml-1">
            {otherAccounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => onSwitchAccount(acc)}
                title={`Быстро перейти на ${acc.name} (@${acc.username.replace('@','')})`}
                className="flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full bg-sky-50 dark:bg-zinc-800 hover:bg-sky-100 dark:hover:bg-zinc-700 border border-sky-200 dark:border-zinc-700 text-sky-700 dark:text-sky-300 transition active:scale-95 cursor-pointer"
              >
                <TelegramAvatar
                  src={acc.avatarUri}
                  name={acc.name}
                  id={acc.id}
                  size="sm"
                  className="w-5 h-5 text-[10px]"
                />
                <span className="text-[11px] font-bold max-w-[65px] truncate">
                  {acc.name.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 text-gray-600 dark:text-zinc-300">
        {onSearch && (
          <button
            type="button"
            onClick={onSearch}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
            aria-label="Search"
            title="Поиск"
          >
            <Search className="w-5 h-5" />
          </button>
        )}

        {onCall && (
          <button
            type="button"
            onClick={onCall}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
            aria-label="Call"
            title="Аудиозвонок"
          >
            <Phone className="w-5 h-5" />
          </button>
        )}

        {onVideoCall && (
          <button
            type="button"
            onClick={onVideoCall}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
            aria-label="Video call"
            title="Видеозвонок"
          >
            <Video className="w-5 h-5" />
          </button>
        )}

        {onMenu && !onBack && !onOptions && (
          <button
            type="button"
            onClick={onMenu}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
            aria-label="Menu"
            title="Меню"
          >
            <MoreVertical className="w-6 h-6" />
          </button>
        )}

        {onOptions && (
          <button
            type="button"
            onClick={onOptions}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
            aria-label="Options"
            title="Опции"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  );
};
