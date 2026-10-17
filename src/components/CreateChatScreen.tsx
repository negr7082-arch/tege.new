import React, { useState, useRef } from 'react';
import { Language, ChatType } from '../types';
import { TegeTopBar } from './TegeTopBar';
import { getT } from '../translations';
import { Send, Users, Radio, MessageSquare, Globe, Lock, ShieldCheck } from 'lucide-react';

interface CreateChatScreenProps {
  language: Language;
  onCreate: (options: {
    type: ChatType;
    name: string;
    username?: string;
    isPrivate?: boolean;
    onlyAdminsCanPost?: boolean;
    firstMessage?: string;
  }) => void;
  onBack: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const CreateChatScreen: React.FC<CreateChatScreenProps> = ({
  language,
  onCreate,
  onBack,
  isDarkMode,
  onToggleTheme
}) => {
  const [chatType, setChatType] = useState<ChatType>('group');
  const [name, setName] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [onlyAdminsCanPost, setOnlyAdminsCanPost] = useState(false);
  const [firstMessage, setFirstMessage] = useState('');
  const t = getT(language);

  // Swipe-to-back gesture
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current !== null && touchStartYRef.current !== null && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStartXRef.current;
      const dy = e.changedTouches[0].clientY - touchStartYRef.current;
      if (touchStartXRef.current < 50 && dx > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        onBack();
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;

    let cleanUsername = customUsername.trim();
    if (cleanUsername) {
      cleanUsername = cleanUsername.startsWith('@') ? cleanUsername : `@${cleanUsername}`;
    }

    onCreate({
      type: chatType,
      name: name.trim(),
      username: cleanUsername || undefined,
      isPrivate,
      onlyAdminsCanPost: chatType === 'channel' ? true : onlyAdminsCanPost,
      firstMessage: firstMessage.trim() || undefined
    });
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="flex flex-col h-full bg-white dark:bg-zinc-950 overflow-y-auto select-none"
    >
      <TegeTopBar
        title={language === 'ru' ? 'Создать диалог, группу или канал' : 'Create Chat, Group, or Channel'}
        onBack={onBack}
      />

      <div className="max-w-md mx-auto w-full p-6 space-y-5">
        {/* Type Selector (Direct Chat / Group / Channel) */}
        <div>
          <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
            {language === 'ru' ? 'Тип создания' : 'Type'}
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setChatType('group')}
              className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                chatType === 'group'
                  ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 ring-2 ring-sky-500/20 font-bold'
                  : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60 text-gray-700 dark:text-zinc-300'
              }`}
            >
              <Users className="w-5 h-5 text-sky-500" />
              <span className="text-xs">{language === 'ru' ? 'Группа' : 'Group'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setChatType('channel');
                setOnlyAdminsCanPost(true);
              }}
              className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                chatType === 'channel'
                  ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 ring-2 ring-sky-500/20 font-bold'
                  : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60 text-gray-700 dark:text-zinc-300'
              }`}
            >
              <Radio className="w-5 h-5 text-indigo-500" />
              <span className="text-xs">{language === 'ru' ? 'Канал' : 'Channel'}</span>
            </button>

            <button
              type="button"
              onClick={() => setChatType('direct')}
              className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                chatType === 'direct'
                  ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 ring-2 ring-sky-500/20 font-bold'
                  : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60 text-gray-700 dark:text-zinc-300'
              }`}
            >
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              <span className="text-xs">{language === 'ru' ? 'Личный чат' : 'Direct'}</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">
              {chatType === 'channel'
                ? (language === 'ru' ? 'Название канала' : 'Channel Name')
                : chatType === 'group'
                ? (language === 'ru' ? 'Название группы (например: tege.org)' : 'Group Name (e.g. tege.org)')
                : (language === 'ru' ? 'Имя собеседника' : 'Contact Name')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                chatType === 'group'
                  ? 'tege.org'
                  : chatType === 'channel'
                  ? 'Новости разработки'
                  : 'Иван Иванов'
              }
              className="w-full px-4 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
            />
          </div>

          {/* ЮЗ (@username) */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">
              {language === 'ru' ? 'ЮЗ (@username, например: @chat_razraba)' : 'Handle (@username, e.g. @chat_razraba)'}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3.5 text-gray-400 font-mono text-sm">@</span>
              <input
                type="text"
                value={customUsername.replace('@', '')}
                onChange={(e) => setCustomUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder={chatType === 'group' ? 'chat_razraba' : 'my_channel'}
                className="w-full pl-8 pr-4 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition font-mono text-sm"
              />
            </div>
            <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1 px-1">
              {language === 'ru' ? 'Любой сможет найти и открыть по этому ЮЗ через глобальный поиск' : 'Searchable globally by this handle'}
            </p>
          </div>

          {/* Privacy Toggle: Public vs Private / Закрытая группа или канал */}
          {chatType !== 'direct' && (
            <div className="pt-1">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
                {language === 'ru' ? 'Доступность' : 'Accessibility'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`p-3 rounded-2xl border text-left transition flex items-start gap-2 ${
                    !isPrivate
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20'
                      : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60 text-gray-700 dark:text-zinc-300'
                  }`}
                >
                  <Globe className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold">{language === 'ru' ? 'Публичный' : 'Public'}</p>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
                      {language === 'ru' ? 'Виден в поиске Tege' : 'Searchable'}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`p-3 rounded-2xl border text-left transition flex items-start gap-2 ${
                    isPrivate
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20'
                      : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60 text-gray-700 dark:text-zinc-300'
                  }`}
                >
                  <Lock className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold">{language === 'ru' ? 'Закрытый / Приват' : 'Private'}</p>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
                      {language === 'ru' ? 'Только по ссылке' : 'Invite only'}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Group Post Permission: only admins/owner can post */}
          {chatType === 'group' && (
            <div className="p-3.5 bg-gray-50 dark:bg-zinc-800/60 rounded-2xl border border-gray-100 dark:border-zinc-700/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-sky-500" />
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-zinc-100">
                    {language === 'ru' ? 'Только владелец и админы могут писать' : 'Only owner and admins can post'}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-400">
                    {language === 'ru' ? 'Обычные участники будут только читать' : 'Regular members will be read-only'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOnlyAdminsCanPost(!onlyAdminsCanPost)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  onlyAdminsCanPost ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
              </button>
            </div>
          )}

          {/* First Message */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">
              {t.firstMsgLabel}
            </label>
            <input
              type="text"
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              placeholder={t.firstMsgPlaceholder}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-6 py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white font-bold rounded-2xl flex items-center gap-2 shadow-lg shadow-sky-500/30 transition active:scale-95"
            >
              <span>{language === 'ru' ? 'Создать' : 'Create'}</span>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
