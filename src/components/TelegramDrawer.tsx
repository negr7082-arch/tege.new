import React, { useState } from 'react';
import { UserAccount, Language } from '../types';
import { getT } from '../translations';
import { TelegramAvatar } from './TelegramAvatar';
import {
  Users,
  Radio,
  User,
  Settings,
  Shield,
  Moon,
  Sun,
  Smartphone,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  Bookmark,
  FileArchive,
  Terminal,
  Circle
} from 'lucide-react';

interface TelegramDrawerProps {
  isOpen: boolean;
  currentUser: UserAccount;
  allAccounts: UserAccount[];
  maxAccounts?: number;
  language: Language;
  isDarkMode: boolean;
  onClose: () => void;
  onSwitchAccount: (account: UserAccount) => void;
  onOpenAddAccount: () => void;
  onRemoveAccount?: (accountId: number) => void;
  onNavigateToGroupCreate: () => void;
  onNavigateToChannelCreate: () => void;
  onNavigateToChannels: () => void;
  onNavigateToProfile: () => void;
  onNavigateToSettings: () => void;
  onOpenSavedMessages?: () => void;
  onNavigateToBlacklist?: () => void;
  onToggleTheme: () => void;
  onOpenInstallModal: () => void;
}

export const TelegramDrawer: React.FC<TelegramDrawerProps> = ({
  isOpen,
  currentUser,
  allAccounts,
  maxAccounts = 5,
  language,
  isDarkMode,
  onClose,
  onSwitchAccount,
  onOpenAddAccount,
  onRemoveAccount,
  onNavigateToGroupCreate,
  onNavigateToChannelCreate,
  onNavigateToChannels,
  onNavigateToProfile,
  onNavigateToSettings,
  onOpenSavedMessages,
  onNavigateToBlacklist,
  onToggleTheme,
  onOpenInstallModal
}) => {
  const [showAccountList, setShowAccountList] = useState(allAccounts.length > 1);
  const [accountToDelete, setAccountToDelete] = useState<number | null>(null);
  const t = getT(language);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="relative w-80 max-w-[85vw] h-full bg-white dark:bg-zinc-900 shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200 border-r border-gray-100 dark:border-zinc-800">
        {/* Drawer Header (Telegram style profile area) */}
        <div className="p-4 bg-gradient-to-br from-sky-500 to-sky-600 dark:from-zinc-800 dark:to-zinc-850 text-white relative flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TelegramAvatar
                src={currentUser.avatarUri}
                name={currentUser.name}
                id={currentUser.id}
                size="lg"
                isOnline={true}
                showOnlineDot={true}
                className="border-2 border-white/80 shadow-md ring-2 ring-emerald-400"
              />
              {/* Quick switch avatars for other accounts (1-tap switch like in Telegram!) */}
              {allAccounts
                .filter((acc) => acc.id !== currentUser.id)
                .map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      onSwitchAccount(acc);
                      onClose();
                    }}
                    title={`${language === 'ru' ? 'Быстро переключить на' : 'Quick switch to'} ${acc.name} (${language === 'ru' ? 'не в сети' : 'offline'})`}
                    className="relative group p-0.5 rounded-full hover:scale-110 active:scale-95 transition"
                  >
                    <TelegramAvatar
                      src={acc.avatarUri}
                      name={acc.name}
                      id={acc.id}
                      size="sm"
                      isOnline={false}
                      className="border-2 border-white/60 shadow-sm opacity-80 hover:opacity-100"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-gray-400 border border-white rounded-full" title="Не в сети" />
                  </button>
                ))}
              {allAccounts.length < maxAccounts && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAddAccount();
                  }}
                  title={language === 'ru' ? 'Добавить аккаунт' : 'Add account'}
                  className="w-8 h-8 rounded-full border-2 border-dashed border-white/60 hover:border-white bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-white truncate">
                  {currentUser.name}
                </h2>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-400/25 text-emerald-200 border border-emerald-400/30 font-semibold">
                  {language === 'ru' ? 'в сети' : 'online'}
                </span>
              </div>
              <p className="text-xs text-sky-100 dark:text-zinc-300 font-mono truncate">
                {currentUser.username.startsWith('@') ? currentUser.username : `@${currentUser.username}`}
              </p>
            </div>

            {/* Toggle Accounts Chevron */}
            <button
              type="button"
              onClick={() => setShowAccountList(!showAccountList)}
              className="p-1.5 text-white hover:bg-white/10 rounded-full transition flex items-center gap-1 text-xs"
              title={language === 'ru' ? 'Управление аккаунтами' : 'Manage accounts'}
            >
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/20">
                {allAccounts.length}/{maxAccounts}
              </span>
              {showAccountList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Multi-Account Switcher Accordion */}
        {showAccountList && (
          <div className="bg-sky-50 dark:bg-zinc-800/80 border-b border-sky-100 dark:border-zinc-700/80 p-3 animate-in slide-in-from-top-2 duration-150 space-y-1.5">
            <div className="flex items-center justify-between px-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider">
              <span>{t.accounts} ({allAccounts.length}/{maxAccounts})</span>
              {allAccounts.length >= maxAccounts ? (
                <span className="text-amber-600 dark:text-amber-400 font-normal normal-case text-[10px]">
                  {language === 'ru' ? 'Лимит 5' : 'Limit 5'}
                </span>
              ) : (
                <span className="text-sky-500 dark:text-sky-400 font-normal normal-case text-[10px]">
                  {language === 'ru' ? 'Быстрый переход в 1 клик' : '1-tap switch'}
                </span>
              )}
            </div>

            {/* Accounts list */}
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {allAccounts.map((acc) => {
                const isActive = acc.id === currentUser.id;
                return (
                  <div
                    key={acc.id}
                    onClick={() => {
                      if (!isActive) {
                        onSwitchAccount(acc);
                        onClose();
                      }
                    }}
                    className={`p-2.5 rounded-xl flex items-center justify-between transition cursor-pointer select-none ${
                      isActive
                        ? 'bg-sky-100 dark:bg-sky-950/70 border border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-200 shadow-xs'
                        : 'hover:bg-white dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TelegramAvatar
                        src={acc.avatarUri}
                        name={acc.name}
                        id={acc.id}
                        size="sm"
                        isOnline={isActive}
                        showOnlineDot={true}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold truncate">{acc.name}</p>
                          {isActive ? (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              • {language === 'ru' ? 'в сети' : 'online'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                              • {language === 'ru' ? 'не в сети' : 'offline'}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-zinc-400 font-mono truncate">{acc.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isActive ? (
                        <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline px-2 py-1 rounded-lg hover:bg-sky-50 dark:hover:bg-zinc-600 transition">
                          {language === 'ru' ? 'Войти' : 'Switch'}
                        </span>
                      )}

                      {!isActive && onRemoveAccount && allAccounts.length > 1 && (
                        accountToDelete === acc.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                onRemoveAccount(acc.id);
                                setAccountToDelete(null);
                              }}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white"
                            >
                              {language === 'ru' ? 'Да' : 'Yes'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setAccountToDelete(null)}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-gray-200 dark:bg-zinc-600 text-gray-700 dark:text-zinc-200"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAccountToDelete(acc.id);
                            }}
                            className="p-1 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-600 transition"
                            title={language === 'ru' ? 'Удалить аккаунт' : 'Remove account'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add account button */}
            {allAccounts.length < maxAccounts ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddAccount();
                }}
                className="w-full mt-1 py-2 px-3 bg-white dark:bg-zinc-700 hover:bg-sky-50 dark:hover:bg-zinc-600 text-sky-600 dark:text-sky-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-dashed border-sky-300 dark:border-zinc-600 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t.addAccount}</span>
              </button>
            ) : (
              <div className="mt-1 p-2 bg-amber-100/70 dark:bg-amber-950/40 rounded-xl text-center text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                {t.accountsLimitReached}
              </div>
            )}
          </div>
        )}

        {/* Drawer Nav Items */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {/* Создать группу */}
          <button
            onClick={() => {
              onClose();
              onNavigateToGroupCreate();
            }}
            className="w-full p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center gap-3.5 text-xs font-semibold text-gray-700 dark:text-zinc-200 transition"
          >
            <Users className="w-5 h-5 text-sky-500 shrink-0" />
            <span>{language === 'ru' ? 'Создать группу' : 'New Group'}</span>
          </button>

          {/* Создать канал */}
          <button
            onClick={() => {
              onClose();
              onNavigateToChannelCreate();
            }}
            className="w-full p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center gap-3.5 text-xs font-semibold text-gray-700 dark:text-zinc-200 transition"
          >
            <Radio className="w-5 h-5 text-indigo-500 shrink-0" />
            <span>{language === 'ru' ? 'Создать канал' : 'New Channel'}</span>
          </button>

          {/* Каталог каналов */}
          <button
            onClick={() => {
              onClose();
              onNavigateToChannels();
            }}
            className="w-full p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center gap-3.5 text-xs font-semibold text-gray-700 dark:text-zinc-200 transition"
          >
            <Bookmark className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>{t.channels}</span>
          </button>

          <div className="my-2 border-t border-gray-100 dark:border-zinc-800" />

          {/* Мой профиль */}
          <button
            onClick={() => {
              onClose();
              onNavigateToProfile();
            }}
            className="w-full p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center gap-3.5 text-xs font-semibold text-gray-700 dark:text-zinc-200 transition"
          >
            <User className="w-5 h-5 text-gray-500 dark:text-zinc-400 shrink-0" />
            <span>{language === 'ru' ? 'Мой профиль' : 'My Profile'}</span>
          </button>

          {/* Настройки */}
          <button
            onClick={() => {
              onClose();
              onNavigateToSettings();
            }}
            className="w-full p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center gap-3.5 text-xs font-semibold text-gray-700 dark:text-zinc-200 transition"
          >
            <Settings className="w-5 h-5 text-gray-500 dark:text-zinc-400 shrink-0" />
            <span>{t.settings}</span>
          </button>

          {/* Чёрный список */}
          {onNavigateToBlacklist && (
            <button
              onClick={() => {
                onClose();
                onNavigateToBlacklist();
              }}
              className="w-full p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center gap-3.5 text-xs font-semibold text-gray-700 dark:text-zinc-200 transition"
            >
              <Shield className="w-5 h-5 text-rose-500 shrink-0" />
              <span>{t.blackList}</span>
            </button>
          )}

          {/* Избранное (Saved Messages) */}
          {onOpenSavedMessages && (
            <button
              onClick={() => {
                onClose();
                onOpenSavedMessages();
              }}
              className="w-full p-2.5 rounded-xl hover:bg-sky-50 dark:hover:bg-zinc-800 flex items-center gap-3.5 text-xs font-semibold text-gray-700 dark:text-zinc-200 transition"
            >
              <Bookmark className="w-5 h-5 text-sky-500 fill-sky-500/20 shrink-0" />
              <span>{t.savedMessages || 'Избранное'}</span>
            </button>
          )}

          {/* Ночной режим */}
          <div className="p-2.5 rounded-xl flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-zinc-200">
            <div className="flex items-center gap-3.5">
              {isDarkMode ? <Sun className="w-5 h-5 text-amber-400 shrink-0" /> : <Moon className="w-5 h-5 text-indigo-500 shrink-0" />}
              <span>{isDarkMode ? (language === 'ru' ? 'Дневной режим' : 'Day mode') : (language === 'ru' ? 'Ночной режим' : 'Night mode')}</span>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                isDarkMode ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-gray-100 dark:border-zinc-800 text-center text-[10px] text-gray-400 dark:text-zinc-500 flex items-center justify-center gap-1.5">
          <Circle className="w-2 h-2 text-emerald-500 fill-emerald-500" />
          <span>TEGE for Android • Multi-Account</span>
        </div>
      </div>
    </div>
  );
};
