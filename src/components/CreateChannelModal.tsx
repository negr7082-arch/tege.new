import React, { useState, useRef } from 'react';
import { Channel, Language } from '../types';
import { getT } from '../translations';
import { sampleColorForId, getNext1122Id } from '../sampleData';
import { Camera, Radio, Globe, Lock, X, Check, Link as LinkIcon } from 'lucide-react';

interface CreateChannelModalProps {
  isOpen: boolean;
  currentUserId?: number;
  language: Language;
  onClose: () => void;
  onCreateChannel: (channel: Channel) => void;
  existingChannel?: Channel | null;
  onOpenExistingChannel?: (channel: Channel) => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  currentUserId,
  language,
  onClose,
  onCreateChannel,
  existingChannel,
  onOpenExistingChannel
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [channelLink, setChannelLink] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = getT(language);

  if (!isOpen) return null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatarUri(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const id = getNext1122Id();
    const cleanLink = isPublic
      ? channelLink.trim()
        ? channelLink.trim().startsWith('@')
          ? channelLink.trim()
          : `@${channelLink.trim()}`
        : `@channel_${id}`
      : `https://tege.im/+join_${id}`;

    const newChannel: Channel = {
      id,
      name: name.trim(),
      description: description.trim(),
      subscribersCount: 1, // The creator is the first subscriber
      avatarUri,
      color: sampleColorForId(id),
      isSubscribed: true,
      isPublic,
      channelLink: cleanLink,
      isOwner: true,
      ownerId: currentUserId
    };

    onCreateChannel(newChannel);
    setName('');
    setDescription('');
    setChannelLink('');
    setAvatarUri(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
              {t.createChannel}
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              {language === 'ru' ? 'Лимит: 1 канал на 1 человека' : 'Limit: 1 channel per person'}
            </p>
          </div>
        </div>

        {existingChannel ? (
          <div className="py-2 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 border border-amber-200 dark:border-amber-900 flex items-center justify-center mx-auto shadow-xs">
              <Radio className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                {language === 'ru' ? 'Лимит: 1 канал на человека' : 'Limit: 1 channel per person'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
                {language === 'ru'
                  ? `У вас уже создан канал «${existingChannel.name}» (${existingChannel.channelLink}). По правилам Tege, на один аккаунт разрешено создать максимум 1 канал.`
                  : `You already have a channel "${existingChannel.name}" (${existingChannel.channelLink}). In Tege, each user can create at most 1 channel.`}
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-2xl border border-gray-100 dark:border-zinc-800 flex items-center justify-between text-left">
              <div className="flex items-center gap-3 min-w-0">
                {existingChannel.avatarUri ? (
                  <img
                    src={existingChannel.avatarUri}
                    alt={existingChannel.name}
                    className="w-10 h-10 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold shrink-0"
                    style={{ backgroundColor: existingChannel.color || '#5BA8FF' }}
                  >
                    {existingChannel.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">{existingChannel.name}</p>
                  <p className="text-xs text-sky-500 font-mono truncate">{existingChannel.channelLink}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (onOpenExistingChannel) onOpenExistingChannel(existingChannel);
                  onClose();
                }}
                className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95"
              >
                {language === 'ru' ? 'Перейти в мой канал' : 'Go to my channel'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 text-gray-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          {/* Channel Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {avatarUri ? (
                <img
                  src={avatarUri}
                  alt="Channel Avatar"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-sky-500 shadow-xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold text-2xl flex items-center justify-center shadow-xs">
                  {name ? name.slice(0, 1).toUpperCase() : <Camera className="w-6 h-6" />}
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white">
                <Camera className="w-5 h-5" />
              </div>
            </div>
            <div className="flex-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-sky-500 hover:text-sky-600"
              >
                {avatarUri ? t.changePhoto : t.uploadPhoto}
              </button>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
                {language === 'ru' ? 'Загрузите изображение для обложки канала' : 'Upload an emblem or cover for your channel'}
              </p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Channel Name */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
              {t.channelNameLabel} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={language === 'ru' ? 'Например: Новости IT и дизайн' : 'e.g. Design & Tech News'}
              className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
              {t.channelDescLabel}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={language === 'ru' ? 'О чём этот канал?...' : 'What is this channel about?...'}
              className="w-full px-3.5 py-2 bg-gray-100 dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
            />
          </div>

          {/* Channel Type: Public or Private */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block">
              {t.channelType}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                  isPublic
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20'
                    : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60 text-gray-700 dark:text-zinc-300'
                }`}
              >
                <Globe className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold">{t.publicChannel}</p>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5 leading-snug">
                    {t.publicChannelDesc}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                  !isPublic
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20'
                    : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60 text-gray-700 dark:text-zinc-300'
                }`}
              >
                <Lock className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold">{t.privateChannel}</p>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5 leading-snug">
                    {t.privateChannelDesc}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Public Link field */}
          {isPublic ? (
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                {t.channelLink}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-gray-400 font-mono">@</span>
                <input
                  type="text"
                  value={channelLink.replace('@', '')}
                  onChange={(e) => setChannelLink(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="my_tege_channel"
                  className="w-full pl-8 pr-3.5 py-2.5 bg-gray-100 dark:bg-zinc-800 text-sm font-mono text-gray-900 dark:text-zinc-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
                />
              </div>
            </div>
          ) : (
            <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-700/60 flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 font-mono">
              <LinkIcon className="w-4 h-4 text-sky-500 shrink-0" />
              <span>Ссылка-приглашение будет создана автоматически</span>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-500/25 active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{t.createChannel}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 text-xs font-semibold rounded-xl transition"
            >
              {t.cancel}
            </button>
          </div>
        </form>
      )}
      </div>
    </div>
  );
};
