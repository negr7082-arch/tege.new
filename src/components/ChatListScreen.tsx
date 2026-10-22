import React, { useState } from 'react';
import { Chat, ContactUser, Language, Channel, Story, UserAccount, Message } from '../types';
import { TegeTopBar } from './TegeTopBar';
import { ChatRow } from './ChatRow';
import { BottomNav } from './BottomNav';
import { getT } from '../translations';
import { realtimeNetwork } from '../services/realtimeNetwork';
import {
  Search,
  X,
  MessageSquarePlus,
  UserPlus,
  Users,
  MessageCircle,
  Radio,
  Plus,
  Bookmark,
  Pin,
  MessageSquare,
  Clock,
  Sparkles,
  Pencil
} from 'lucide-react';
import { TelegramAvatar } from './TelegramAvatar';

interface ChatListScreenProps {
  chats: Chat[];
  channels?: Channel[];
  stories?: Story[];
  currentUser?: UserAccount;
  currentUserId?: number;
  language: Language;
  onOpenChat: (chatId: number) => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenChannels: () => void;
  onSelectChannel?: (channel: Channel) => void;
  onOpenCreateStory?: () => void;
  onViewStory?: (index: number) => void;
  onOpenCreateChat: () => void;
  onSelectContactUser: (user: ContactUser) => void;
  onOpenSavedMessages?: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  accounts?: UserAccount[];
  onSwitchAccount?: (acc: UserAccount) => void;
}

type SearchTab = 'all' | 'chats' | 'channels' | 'users' | 'messages';

export const ChatListScreen: React.FC<ChatListScreenProps> = ({
  chats,
  channels = [],
  stories = [],
  currentUser,
  currentUserId,
  language,
  onOpenChat,
  onOpenProfile,
  onOpenSettings,
  onOpenChannels,
  onSelectChannel,
  onOpenCreateStory,
  onViewStory,
  onOpenCreateChat,
  onSelectContactUser,
  onOpenSavedMessages,
  isDarkMode,
  onToggleTheme,
  accounts,
  onSwitchAccount
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const t = getT(language);

  const cleanQuery = searchQuery.trim().toLowerCase();
  const strippedQuery = cleanQuery.replace('@', '');

  // 1. Matching existing active chats by name, handle (@username), or ID
  const matchingChats = chats.filter((c) => {
    if (!cleanQuery) return true;
    const matchName = c.name.toLowerCase().includes(cleanQuery);
    const matchUsername = c.username ? c.username.toLowerCase().includes(cleanQuery) : false;
    const matchId = c.userId?.toString() === cleanQuery.replace('#', '') || c.id.toString() === cleanQuery.replace('#', '');
    const matchMsg = c.lastMessage.toLowerCase().includes(cleanQuery);
    return matchName || matchUsername || matchId || matchMsg;
  });

  // 2. Global Search: Real registered people from network directory
  const registeredPeople = cleanQuery
    ? realtimeNetwork.searchRegisteredUsers(cleanQuery, currentUserId)
    : [];

  // 3. Global Search: Public channels across local and network directory
  const networkChannels = cleanQuery ? realtimeNetwork.searchPublicChannels(cleanQuery) : [];
  const combinedChannels = [...channels];
  networkChannels.forEach((netCh) => {
    if (!combinedChannels.some((c) => c.id === netCh.id)) {
      combinedChannels.push(netCh);
    }
  });

  const matchingChannels = cleanQuery
    ? combinedChannels.filter((ch) => {
        const link = (ch.channelLink || '').toLowerCase();
        const strippedLink = link.replace('@', '');
        const matchHandle = link.includes(cleanQuery) || (strippedQuery.length > 0 && strippedLink.includes(strippedQuery));
        const matchName = ch.name.toLowerCase().includes(cleanQuery);
        return matchHandle || matchName;
      })
    : [];

  // 4. Global Search: Public groups across local chats and network directory
  const networkGroups = cleanQuery ? realtimeNetwork.searchPublicGroups(cleanQuery) : [];
  const localGroups = chats.filter((c) => c.type === 'group');
  const combinedGroups = [...localGroups];
  networkGroups.forEach((ng) => {
    if (!combinedGroups.some((g) => g.id === ng.id)) {
      combinedGroups.push(ng);
    }
  });

  const matchingGroups = cleanQuery
    ? combinedGroups.filter((g) => {
        const username = (g.username || '').toLowerCase();
        const strippedUser = username.replace('@', '');
        const matchHandle = username.includes(cleanQuery) || (strippedQuery.length > 0 && strippedUser.includes(strippedQuery));
        const matchName = g.name.toLowerCase().includes(cleanQuery);
        return matchHandle || matchName;
      })
    : [];

  // 5. Messages found in active chats with content snippet
  const matchingMessages: { chat: Chat; message: Message }[] = [];
  if (cleanQuery) {
    chats.forEach((chat) => {
      chat.messages.forEach((msg) => {
        if (msg.text && msg.text.toLowerCase().includes(cleanQuery)) {
          matchingMessages.push({ chat, message: msg });
        }
      });
    });
  }

  // Saved messages chat (pinned at top)
  const savedMessagesChat = chats.find((c) => c.id === 999999 || c.isSavedMessages);

  const hasAnyResults =
    matchingChats.length > 0 ||
    registeredPeople.length > 0 ||
    matchingChannels.length > 0 ||
    matchingGroups.length > 0 ||
    matchingMessages.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-[#17212b] relative select-none">
      {/* Clean Telegram Top Bar: side menu drawer button and title */}
      <TegeTopBar
        title={t.appName}
        onMenu={onOpenChannels}
      />

      {/* TELEGRAM UNIFIED SEARCH BAR (No confusing ID / ЮЗ toggles!) */}
      <div className="px-3.5 pb-3 bg-white dark:bg-[#17212b] transition-colors">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-gray-400 dark:text-zinc-500 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'ru' ? 'Поиск' : 'Search'}
            className="w-full min-h-[42px] pl-10 pr-10 py-2.5 bg-[#f1f3f5] dark:bg-[#242f3d] text-[15px] text-gray-900 dark:text-zinc-100 rounded-full placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 border border-transparent transition"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearchFocused(false);
              }}
              className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Telegram Search Horizontal Tabs (Visible when search is active or querying) */}
        {(cleanQuery || isSearchFocused) && (
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { id: 'all', label: language === 'ru' ? 'Все' : 'All' },
              { id: 'chats', label: language === 'ru' ? 'Чаты' : 'Chats' },
              { id: 'channels', label: language === 'ru' ? 'Каналы' : 'Channels' },
              { id: 'users', label: language === 'ru' ? 'Люди' : 'People' },
              { id: 'messages', label: language === 'ru' ? 'Сообщения' : 'Messages' }
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SearchTab)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                    isSelected
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-750'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Telegram Stories Horizontal Bar (Only when not actively searching) */}
        {!cleanQuery && (
          <div className="py-3 px-4 border-b border-gray-100/80 dark:border-white/[0.045] bg-white dark:bg-[#17212b]">
            <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
              {/* My Story item */}
              <div className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group">
                <div
                  className="relative"
                  onClick={() => {
                    const myIdx = stories.findIndex((s) => s.isMine || s.authorId === currentUserId);
                    if (myIdx !== -1 && onViewStory) {
                      onViewStory(myIdx);
                    } else if (onOpenCreateStory) {
                      onOpenCreateStory();
                    }
                  }}
                >
                  <div
                    className={`p-0.5 rounded-full transition ${
                      stories.some((s) => s.isMine || s.authorId === currentUserId)
                        ? 'bg-gradient-to-tr from-pink-500 via-purple-500 to-sky-400 shadow-xs'
                        : 'border border-dashed border-gray-300 dark:border-zinc-700'
                    }`}
                  >
                    {currentUser?.avatarUri ? (
                      <img
                        src={currentUser.avatarUri}
                        alt="My story"
                        className="w-13 h-13 rounded-full object-cover border-2 border-white dark:border-zinc-900"
                      />
                    ) : (
                      <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center border-2 border-white dark:border-zinc-900">
                        {currentUser?.name ? currentUser.name.slice(0, 1).toUpperCase() : '+'}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCreateStory && onOpenCreateStory();
                    }}
                    className="absolute -bottom-0.5 -right-0.5 p-1 bg-sky-500 hover:bg-sky-600 text-white rounded-full shadow-md transition active:scale-90"
                    title={t.addStory}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <span className="text-[11px] font-medium text-gray-700 dark:text-zinc-300 max-w-[62px] truncate text-center">
                  {stories.some((s) => s.isMine || s.authorId === currentUserId) ? t.myStory : t.addStory}
                </span>
              </div>

              {/* Other Stories */}
              {stories
                .filter((s) => !s.isMine && s.authorId !== currentUserId)
                .map((story) => {
                  const globalIdx = stories.findIndex((st) => st.id === story.id);
                  return (
                    <div
                      key={story.id}
                      onClick={() => onViewStory && onViewStory(globalIdx !== -1 ? globalIdx : 0)}
                      className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
                    >
                      <div className="p-0.5 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-sky-400 shadow-xs group-hover:scale-105 transition transform">
                        {story.authorAvatarUri ? (
                          <img
                            src={story.authorAvatarUri}
                            alt={story.authorName}
                            className="w-13 h-13 rounded-full object-cover border-2 border-white dark:border-zinc-900"
                          />
                        ) : (
                          <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-500 text-white font-bold text-sm flex items-center justify-center border-2 border-white dark:border-zinc-900">
                            {story.authorName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-gray-700 dark:text-zinc-300 max-w-[62px] truncate text-center">
                        {story.authorName.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TELEGRAM SEARCH RESULTS VIEW */}
        {cleanQuery ? (
          <div className="p-3 space-y-4">
            {!hasAnyResults ? (
              <div className="py-14 px-6 text-center flex flex-col items-center justify-center animate-in fade-in select-none">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 flex items-center justify-center mb-3 shadow-xs">
                  <Search className="w-8 h-8 opacity-60" />
                </div>
                <h4 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                  {language === 'ru' ? 'Ничего не найдено' : 'No results found'}
                </h4>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-xs leading-relaxed">
                  {language === 'ru'
                    ? `По запросу «${searchQuery}» ничего не найдено. Попробуйте ввести другое имя, @username или текст сообщения.`
                    : `No matches found for "${searchQuery}". Try searching by name, @username, or message text.`}
                </p>
              </div>
            ) : null}

            {/* SECTION 1: Matching Active Chats */}
            {(activeTab === 'all' || activeTab === 'chats') && matchingChats.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 mb-2 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                  <span>{t.chats} ({matchingChats.length})</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-800/40 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-xs">
                  {matchingChats.map((chat) => (
                    <ChatRow
                      key={chat.id}
                      chat={chat}
                      onClick={() => {
                        onOpenChat(chat.id);
                        setSearchQuery('');
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 2: Global Search - Registered People */}
            {(activeTab === 'all' || activeTab === 'users') && registeredPeople.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 mb-2 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  <Users className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{t.globalSearch} • {language === 'ru' ? 'Люди' : 'People'} ({registeredPeople.length})</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-800/40 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-xs">
                  {registeredPeople.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => {
                        onSelectContactUser(user);
                        setSearchQuery('');
                      }}
                      className="p-3 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-between transition"
                    >
                      <div className="flex items-center gap-3">
                        <TelegramAvatar
                          src={user.avatarUri}
                          name={user.name}
                          id={user.id}
                          size="md"
                          isOnline={user.online}
                          showOnlineDot={true}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-900 dark:text-zinc-100">
                              {user.name}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              #{user.id}
                            </span>
                          </div>
                          <p className="text-xs text-sky-500 font-mono mt-0.5">
                            {user.username.startsWith('@') ? user.username : `@${user.username}`}
                          </p>
                        </div>
                      </div>
                      <UserPlus className="w-5 h-5 text-sky-500 mr-2" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 3: Global Search - Public Channels */}
            {(activeTab === 'all' || activeTab === 'channels') && matchingChannels.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 mb-2 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  <Radio className="w-3.5 h-3.5 text-sky-500" />
                  <span>{t.globalSearch} • {t.channels} ({matchingChannels.length})</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-800/40 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-xs">
                  {matchingChannels.map((channel) => (
                    <div
                      key={channel.id}
                      onClick={() => {
                        if (onSelectChannel) {
                          onSelectChannel(channel);
                        } else {
                          onOpenChannels();
                        }
                        setSearchQuery('');
                      }}
                      className="p-3 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-between transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {channel.avatarUri ? (
                          <img
                            src={channel.avatarUri}
                            alt={channel.name}
                            className="w-10 h-10 rounded-2xl object-cover shrink-0 shadow-xs"
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs"
                            style={{ backgroundColor: channel.color }}
                          >
                            {channel.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100 truncate">
                              {channel.name}
                            </span>
                            <span className="text-xs font-mono text-sky-500 font-medium">
                              {channel.channelLink}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-zinc-500 truncate mt-0.5">
                            {channel.subscribersCount} {t.subscribers}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-sky-500 font-semibold mr-1">Перейти →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 4: Groups */}
            {(activeTab === 'all' || activeTab === 'channels') && matchingGroups.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 mb-2 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{language === 'ru' ? 'Группы' : 'Groups'} ({matchingGroups.length})</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-800/40 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-xs">
                  {matchingGroups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => {
                        onOpenChat(group.id);
                        setSearchQuery('');
                      }}
                      className="p-3 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-between transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <TelegramAvatar
                          src={group.avatarUri}
                          name={group.name}
                          id={group.id}
                          size="md"
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100 truncate block">
                            {group.name}
                          </span>
                          <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">
                            {group.membersCount || 1} {language === 'ru' ? 'участников' : 'members'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-indigo-500 font-semibold mr-1">Открыть →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 5: Matching Messages in Chats */}
            {(activeTab === 'all' || activeTab === 'messages') && matchingMessages.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 mb-2 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                  <span>{t.messagesFound} ({matchingMessages.length})</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-800/40 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-xs">
                  {matchingMessages.map(({ chat, message }) => (
                    <div
                      key={`${chat.id}-${message.id}`}
                      onClick={() => {
                        onOpenChat(chat.id);
                        setSearchQuery('');
                      }}
                      className="p-3 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-between gap-3 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <TelegramAvatar
                          src={chat.avatarUri}
                          name={chat.name}
                          id={chat.id}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-gray-900 dark:text-zinc-100 truncate">
                              {chat.name}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {message.time}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-zinc-300 truncate mt-0.5">
                            {message.text}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-sky-500 font-semibold shrink-0">Чат →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* REGULAR CHAT LIST */
          <div className="pb-28">
            {/* PINNED "ИЗБРАННОЕ" (SAVED MESSAGES) ROW AT TOP */}
            <div
              onClick={() => {
                if (savedMessagesChat) {
                  onOpenChat(savedMessagesChat.id);
                } else if (onOpenSavedMessages) {
                  onOpenSavedMessages();
                }
              }}
              className="flex items-center px-4 py-2.5 cursor-pointer select-none border-b border-gray-100/80 dark:border-white/[0.04] active:bg-gray-100 dark:active:bg-zinc-800 transition-colors"
            >
              <div className="w-15 h-15 rounded-full bg-gradient-to-b from-sky-400 to-sky-600 text-white flex items-center justify-center shrink-0">
                <Bookmark className="w-6 h-6 fill-white text-white" />
              </div>

              <div className="ml-3 flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-medium text-[17px] text-gray-900 dark:text-white">
                    {t.savedMessages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400 dark:text-zinc-500">
                      {savedMessagesChat ? savedMessagesChat.time : ''}
                    </span>
                    <Pin className="w-3.5 h-3.5 text-sky-500 rotate-45 shrink-0" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[15px] text-gray-500 dark:text-zinc-400 truncate">
                    {savedMessagesChat?.lastMessage || t.savedMessagesSub}
                  </p>
                </div>
              </div>
            </div>

            {/* OTHER ACTIVE CHATS */}
            {chats
              .filter((c) => c.id !== 999999 && !c.isSavedMessages)
              .map((chat) => (
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  onClick={() => onOpenChat(chat.id)}
                />
              ))}

            {/* Empty State when no other chats exist */}
            {chats.filter((c) => c.id !== 999999 && !c.isSavedMessages).length === 0 && (
              <div className="p-8 flex flex-col items-center justify-center text-center mt-6">
                <div className="w-16 h-16 rounded-3xl bg-sky-50 dark:bg-sky-950/40 text-sky-500 flex items-center justify-center mb-3 shadow-xs">
                  <MessageCircle className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                  {t.noChats}
                </h4>
                <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-xs mt-1 mb-5 leading-relaxed">
                  {language === 'ru'
                    ? 'Найдите человека через поиск выше или нажмите на карандаш снизу, чтобы начать диалог.'
                    : 'Search for someone above or tap the pencil button below to start a chat.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Telegram Floating Action Button (FAB) for New Chat / Message */}
      <div className="absolute bottom-24 right-5 z-20">
        <button
          onClick={onOpenCreateChat}
          className="w-14 h-14 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white rounded-full flex items-center justify-center shadow-lg shadow-sky-500/25 transition-all duration-200"
          aria-label={t.newChat}
          title={t.newChat}
        >
          <Pencil className="w-6 h-6" />
        </button>
      </div>

      {/* Telegram floating bottom navigation */}
      <BottomNav
        active="chats"
        language={language}
        user={currentUser}
        onChats={() => {}}
        onContacts={onOpenCreateChat}
        onSettings={onOpenSettings}
        onProfile={onOpenProfile}
      />
    </div>
  );
};
