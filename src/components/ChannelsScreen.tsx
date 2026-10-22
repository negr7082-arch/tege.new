import React, { useState } from 'react';
import { Channel, Language } from '../types';
import { TegeTopBar } from './TegeTopBar';
import { CreateChannelModal } from './CreateChannelModal';
import { getT } from '../translations';
import { Users, Check, Plus, Radio, PlusCircle, Globe, Lock, ArrowRight, Camera } from 'lucide-react';

interface ChannelsScreenProps {
  channels: Channel[];
  currentUserId?: number;
  language: Language;
  onUpdateChannels: (channels: Channel[]) => void;
  onSelectChannel?: (channel: Channel) => void;
  onUpdateChannelAvatar?: (channelId: number, avatarUri: string | null) => void;
  onBack: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const ChannelsScreen: React.FC<ChannelsScreenProps> = ({
  channels,
  currentUserId,
  language,
  onUpdateChannels,
  onSelectChannel,
  onUpdateChannelAvatar,
  onBack,
  isDarkMode,
  onToggleTheme
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const t = getT(language);

  const toggleSubscribe = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateChannels(
      channels.map((ch) =>
        ch.id === id
          ? {
              ...ch,
              isSubscribed: !ch.isSubscribed,
              subscribersCount: ch.isSubscribed ? ch.subscribersCount - 1 : ch.subscribersCount + 1
            }
          : ch
      )
    );
  };

  const handleCreateChannel = (newChannel: Channel) => {
    onUpdateChannels([newChannel, ...channels]);
    if (onSelectChannel) {
      onSelectChannel(newChannel);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f4f4f5] dark:bg-[#0e1621] overflow-y-auto select-none">
      <TegeTopBar
        title={t.channels}
        onBack={onBack}
      />

      <div className="max-w-xl mx-auto w-full px-3 py-4 sm:p-4 space-y-4">
        {/* Banner with Create Channel CTA */}
        <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/40 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
              <Radio className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">
                {t.discoverChannels}
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 truncate">
                {language === 'ru' ? 'Каналы для трансляции новостей. В канале посты публикуют только авторы.' : t.discoverChannelsDesc}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shrink-0 shadow-md shadow-sky-500/20 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t.createChannel}</span>
          </button>
        </div>

        {/* Channels List */}
        <div className="divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-xs">
          {channels.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-zinc-500 text-xs">
              {language === 'ru' ? 'Каналов пока нет. Создайте свой первый канал!' : 'No channels yet. Create your first channel!'}
            </div>
          ) : (
            channels.map((channel) => {
              const isChannelOwner = Boolean(channel.isOwner || (currentUserId && channel.ownerId === currentUserId));

              const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const newUri = event.target?.result as string;
                    onUpdateChannels(
                      channels.map((ch) => ch.id === channel.id ? { ...ch, avatarUri: newUri } : ch)
                    );
                    if (onUpdateChannelAvatar) {
                      onUpdateChannelAvatar(channel.id, newUri);
                    }
                  };
                  reader.readAsDataURL(file);
                }
              };

              return (
                <div
                  key={channel.id}
                  onClick={() => onSelectChannel && onSelectChannel(channel)}
                  className="p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800/60 cursor-pointer transition relative group"
                >
                  <div className="relative shrink-0" onClick={(e) => isChannelOwner && e.stopPropagation()}>
                    {channel.avatarUri ? (
                      <img
                        src={channel.avatarUri}
                        alt={channel.name}
                        className="w-12 h-12 rounded-2xl object-cover shadow-xs"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-xs"
                        style={{ backgroundColor: channel.color || '#5BA8FF' }}
                      >
                        {channel.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}

                    {isChannelOwner && (
                      <label
                        className="absolute -bottom-1 -right-1 p-1 bg-sky-500 hover:bg-sky-600 text-white rounded-full shadow-md cursor-pointer transition active:scale-90"
                        title={language === 'ru' ? 'Сменить фото канала' : 'Change channel photo'}
                      >
                        <Camera className="w-3 h-3" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <h4 className="font-semibold text-sm text-gray-900 dark:text-zinc-100 truncate">
                        {channel.name}
                      </h4>
                      {channel.isOwner && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-300 font-bold rounded">
                          {language === 'ru' ? 'Автор' : 'Owner'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => toggleSubscribe(channel.id, e)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition active:scale-95 flex items-center gap-1 shrink-0 ${
                          channel.isSubscribed
                            ? 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300'
                            : 'bg-sky-500 hover:bg-sky-600 text-white'
                        }`}
                      >
                        {channel.isSubscribed ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> {t.subscribed}
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" /> {t.join}
                          </>
                        )}
                      </button>
                      <ArrowRight className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
                    </div>
                  </div>

                  {channel.channelLink && (
                    <div className="flex items-center gap-1 text-[11px] text-sky-500 font-medium mt-0.5">
                      {channel.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      <span>{channel.channelLink}</span>
                    </div>
                  )}

                  {channel.description && (
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 line-clamp-2">
                      {channel.description}
                    </p>
                  )}

                  <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-zinc-500 mt-2">
                    <Users className="w-3 h-3" />
                    <span>{channel.subscribersCount.toLocaleString()} {t.subscribers}</span>
                  </div>
                </div>
              </div>
            );
          })
          )}
        </div>
      </div>

      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={showCreateModal}
        currentUserId={currentUserId}
        language={language}
        onClose={() => setShowCreateModal(false)}
        onCreateChannel={handleCreateChannel}
      />
    </div>
  );
};
