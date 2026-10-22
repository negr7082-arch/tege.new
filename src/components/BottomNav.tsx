import React from 'react';
import { MessageCircle, Users, Settings } from 'lucide-react';
import { TelegramAvatar } from './TelegramAvatar';
import type { Language } from '../types';

export type BottomNavTab = 'chats' | 'contacts' | 'settings' | 'profile';

interface BottomNavProps {
  active: BottomNavTab;
  language: Language;
  user?: { id?: number; name?: string; avatarUri?: string | null } | null;
  onChats: () => void;
  onContacts: () => void;
  onSettings: () => void;
  onProfile: () => void;
}

// Telegram 12.4 style floating glass bottom navigation bar
export const BottomNav: React.FC<BottomNavProps> = ({
  active,
  language,
  user,
  onChats,
  onContacts,
  onSettings,
  onProfile
}) => {
  const ru = language === 'ru';
  const item = (tab: BottomNavTab) =>
    `flex basis-0 flex-1 min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-1.5 rounded-xl transition ${
      active === tab ? 'bg-sky-500/15 text-sky-500' : 'text-gray-500 dark:text-zinc-300'
    }`;

  return (
    <nav style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }} className="fixed left-0 right-0 z-50 mx-auto h-[68px] w-full max-w-none rounded-none bg-white/95 dark:bg-[#17212b] backdrop-blur-xl border-t border-gray-200 dark:border-white/10 shadow-none flex items-center justify-around gap-0 px-2 select-none">
      <button type="button" onClick={onChats} className={item('chats')}>
        <MessageCircle className="w-6 h-6" />
        <span className="block max-w-full truncate whitespace-nowrap text-[10px] leading-tight sm:text-xs font-medium">{ru ? 'Чаты' : 'Chats'}</span>
      </button>
      <button type="button" onClick={onContacts} className={item('contacts')}>
        <Users className="w-6 h-6" />
        <span className="block max-w-full truncate whitespace-nowrap text-[10px] leading-tight sm:text-xs font-medium">{ru ? 'Контакты' : 'Contacts'}</span>
      </button>
      <button type="button" onClick={onSettings} className={item('settings')}>
        <Settings className="w-6 h-6" />
        <span className="block max-w-full truncate whitespace-nowrap text-[10px] leading-tight sm:text-xs font-medium">{ru ? 'Настройки' : 'Settings'}</span>
      </button>
      <button type="button" onClick={onProfile} className={item('profile')}>
        <TelegramAvatar
          src={user?.avatarUri}
          name={user?.name}
          id={user?.id}
          size="xs"
          className="w-6 h-6 text-[11px]"
        />
        <span className="block max-w-full truncate whitespace-nowrap text-[10px] leading-tight sm:text-xs font-medium">{ru ? 'Профиль' : 'Profile'}</span>
      </button>
    </nav>
  );
};
