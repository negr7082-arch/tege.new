import React, { useState } from 'react';
import { BlockedUser, Language } from '../types';
import { getT } from '../translations';
import { TelegramAvatar } from './TelegramAvatar';
import { Shield, X, Unlock, UserX, Plus, Search } from 'lucide-react';
import { realtimeNetwork } from '../services/realtimeNetwork';

interface BlacklistModalProps {
  language: Language;
  currentUserId: number;
  blockedUsers: BlockedUser[];
  onUnblock: (userId: number) => void;
  onBlockUser: (user: BlockedUser) => void;
  onClose: () => void;
}

export const BlacklistModal: React.FC<BlacklistModalProps> = ({
  language,
  currentUserId,
  blockedUsers,
  onUnblock,
  onBlockUser,
  onClose
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const t = getT(language);

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const clean = inputQuery.trim();
    if (!clean) return;

    // Search for registered user
    const foundUsers = realtimeNetwork.searchRegisteredUsers(clean, currentUserId);
    if (foundUsers.length > 0) {
      const user = foundUsers[0];
      onBlockUser({
        id: user.id,
        name: user.name,
        username: user.username,
        avatarUri: user.avatarUri,
        blockedAt: Date.now()
      });
      setInputQuery('');
      setShowAddForm(false);
      return;
    }

    // If ID or username was typed directly
    const isNum = /^\d+$/.test(clean.replace('#', ''));
    const parsedId = isNum ? parseInt(clean.replace('#', ''), 10) : 1122000 + Math.floor(Math.random() * 80000);
    const username = clean.startsWith('@') ? clean : isNum ? `@id${parsedId}` : `@${clean}`;
    const name = clean.replace('@', '');

    onBlockUser({
      id: parsedId,
      name,
      username,
      blockedAt: Date.now()
    });

    setInputQuery('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in select-none">
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl max-w-md w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                {t.blackList}
              </h3>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 font-medium">
                {blockedUsers.length} {language === 'ru' ? 'заблокировано' : 'blocked'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="p-1.5 text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-full transition"
              title={t.blockUser}
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Add user form */}
        {showAddForm && (
          <form onSubmit={handleAddBlock} className="p-4 bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800 space-y-2">
            <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
              {language === 'ru' ? 'Заблокировать по @юзернейму или ID:' : 'Block by @username or ID:'}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="@username или 1122..."
                className="flex-1 px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-mono text-gray-900 dark:text-zinc-100"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim()}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
              >
                {language === 'ru' ? 'Заблокировать' : 'Block'}
              </button>
            </div>
            {errorMsg && <p className="text-[11px] text-rose-500">{errorMsg}</p>}
          </form>
        )}

        {/* List of blocked users */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {blockedUsers.length === 0 ? (
            <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-400 flex items-center justify-center mb-3">
                <UserX className="w-7 h-7 opacity-60" />
              </div>
              <p className="text-sm font-bold text-gray-800 dark:text-zinc-200">
                {t.noBlockedUsers}
              </p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1 max-w-xs leading-relaxed">
                {language === 'ru'
                  ? 'Заблокированные пользователи не смогут писать вам сообщения и видеть ваш сетевой статус.'
                  : 'Blocked users will not be able to send you messages or see your online status.'}
              </p>
            </div>
          ) : (
            blockedUsers.map((user) => (
              <div
                key={user.id}
                className="p-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-800 rounded-2xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TelegramAvatar
                    src={user.avatarUri}
                    name={user.name}
                    id={user.id}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-gray-900 dark:text-zinc-100 truncate">
                      {user.name}
                    </p>
                    <p className="text-[11px] font-mono text-gray-400 dark:text-zinc-400 truncate">
                      {user.username} • ID: #{user.id}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onUnblock(user.id)}
                  className="px-3 py-1.5 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-600 dark:text-sky-400 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>{t.unblockUser}</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-gray-50/80 dark:bg-zinc-950/60 border-t border-gray-100 dark:border-zinc-800 text-center">
          <p className="text-[11px] text-gray-400 dark:text-zinc-500">
            {language === 'ru'
              ? 'Разблокированные пользователи снова смогут отправлять вам сообщения.'
              : 'Unblocked users will be able to message you again.'}
          </p>
        </div>
      </div>
    </div>
  );
};
