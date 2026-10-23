import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Chat,
  Message,
  UserProfile,
  ScreenRoute,
  ContactUser,
  AppSettings,
  UserAccount,
  Channel,
  ChatType,
  Poll,
  MessageReplyInfo,
  Story,
  BlockedUser
} from './types';
import {
  initialSampleChats,
  defaultSampleChannels,
  sampleColorForId,
  getNext1122Id
} from './sampleData';
import { realtimeNetwork, NetworkMessagePayload, ConnectionStatus } from './services/realtimeNetwork';
import { ChatListScreen } from './components/ChatListScreen';
import { BottomNav } from './components/BottomNav';
import { ChatDetailScreen } from './components/ChatDetailScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { ChannelsScreen } from './components/ChannelsScreen';
import { CreateChatScreen } from './components/CreateChatScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { AuthScreen } from './components/AuthScreen';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { PWAInstallModal } from './components/PWAInstallModal';
import { StoryCreatorModal } from './components/StoryCreatorModal';
import { StoryViewerModal } from './components/StoryViewerModal';
import { TelegramDrawer } from './components/TelegramDrawer';
import { AddAccountModal } from './components/AddAccountModal';
import { VolunteerScreen } from './components/VolunteerScreen';
import { getT } from './translations';
import { refreshPush } from './services/pushService';

// Short text for the chat list preview, for any kind of message
function messagePreview(m: Message | undefined, ru: boolean): string {
  if (!m) return '';
  if (m.poll) return (ru ? '📊 Опрос: ' : '📊 Poll: ') + m.poll.question;
  if (m.videoNoteUri) return ru ? '⚪ Видеосообщение' : '⚪ Video note';
  if (m.isVoice) return ru ? '🎤 Голосовое сообщение' : '🎤 Voice message';
  if (m.audioUri) return ru ? '🎵 Аудио' : '🎵 Audio';
  if (m.fileUri) return `📁 ${m.fileName || (ru ? 'Файл' : 'File')}`;
  if (m.text) return m.text;
  if (m.videoUri) return ru ? '📹 Видео' : '📹 Video';
  if (m.attachmentUri) return ru ? '📷 Фото' : '📷 Photo';
  return '';
}
import { Smartphone, Search } from 'lucide-react';

const STORAGE_CHATS_KEY = 'tege_chats_pure_v3';
const STORAGE_ACCOUNT_KEY = 'tege_active_session_user_v5';
const STORAGE_REGISTERED_KEY = 'tege_registered_accounts_v1';
const STORAGE_MULTI_ACCOUNTS_KEY = 'tege_multi_accounts_list_v2';
const STORAGE_SETTINGS_KEY = 'tege_settings_v3';
const STORAGE_CHANNELS_KEY = 'tege_channels_v3';
const STORAGE_STORIES_KEY = 'tege_stories_v3';

// Local chat data is keyed by account id. Ids from the old browser-only era (1122101, ...) collide with ids
// issued by the server, so a NEW account could show someone else's old chats. We remember which e-mail owns
// the local data of every id and wipe it when a different e-mail takes that id over.
function purgeLocalDataForId(id: number) {
  try {
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k === `tege_user_chats_${id}` ||
        k === `tege_user_channels_${id}` ||
        k === `tege_user_stories_${id}` ||
        k === `tege_outbox_${id}` ||
        k.startsWith(`tege_streak_${id}_`)
      ) drop.push(k);
    }
    drop.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

function claimLocalDataFor(acc: { id: number; email: string }) {
  try {
    const email = String(acc.email || '').toLowerCase();
    if (!email) return;
    const owner = localStorage.getItem(`tege_owner_${acc.id}`);
    let foreign = false;
    if (owner) {
      foreign = owner !== email;
    } else {
      const reg = JSON.parse(localStorage.getItem(STORAGE_REGISTERED_KEY) || '[]');
      foreign = Array.isArray(reg) && reg.some((a: any) => a && a.id === acc.id && String(a.email).toLowerCase() !== email);
    }
    if (foreign) purgeLocalDataForId(acc.id);
    localStorage.setItem(`tege_owner_${acc.id}`, email);
  } catch {}
}

// Runs once at load, before the saved session is read, so an already logged-in account gets fixed too.
try {
  const savedSession = localStorage.getItem(STORAGE_ACCOUNT_KEY);
  if (savedSession) claimLocalDataFor(JSON.parse(savedSession));
} catch {}
const MAX_ACCOUNTS = 5;

const defaultSettings: AppSettings = {
  isDarkMode: false,
  language: 'ru',
  textSize: 'medium',
  wallpaper: 'pattern',
  soundEnabled: true,
  notificationsEnabled: true
};

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (saved) return { ...defaultSettings, ...JSON.parse(saved) };
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return { ...defaultSettings, isDarkMode: systemDark };
    } catch {
      return defaultSettings;
    }
  });

  // When downloaded/installed, user is not logged in by default -> triggers AuthScreen
  const [account, setAccount] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ACCOUNT_KEY);
      const parsed: UserAccount | null = saved ? JSON.parse(saved) : null;
      // Sessions created before the server existed have no token -> sign in again
      return parsed && parsed.token ? parsed : null;
    } catch {
      return null;
    }
  });

  // Multi-account management: accounts list up to 5 accounts
  const [accounts, setAccounts] = useState<UserAccount[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_MULTI_ACCOUNTS_KEY);
      if (raw) {
        const parsed: UserAccount[] = JSON.parse(raw).filter((a: UserAccount) => a.token);
        if (parsed.length > 0) return parsed;
      }
      const active = localStorage.getItem(STORAGE_ACCOUNT_KEY);
      if (active) {
        const a: UserAccount = JSON.parse(active);
        if (a.token) return [a];
      }
      return [];
    } catch {
      return [];
    }
  });

  const [showDrawer, setShowDrawer] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);

  // Active chats scoped to current logged-in user
  const [chats, setChats] = useState<Chat[]>(() => {
    try {
      const savedAcc = localStorage.getItem(STORAGE_ACCOUNT_KEY);
      const acc = savedAcc ? JSON.parse(savedAcc) : null;
      if (!acc) return [];
      const savedChats = localStorage.getItem(`tege_user_chats_${acc.id}`);
      return savedChats ? JSON.parse(savedChats) : [];
    } catch {
      return [];
    }
  });

  // Active channels scoped to current logged-in user
  const [channels, setChannels] = useState<Channel[]>(() => {
    try {
      const savedAcc = localStorage.getItem(STORAGE_ACCOUNT_KEY);
      const acc = savedAcc ? JSON.parse(savedAcc) : null;
      if (!acc) return [];
      const savedChannels = localStorage.getItem(`tege_user_channels_${acc.id}`);
      return savedChannels ? JSON.parse(savedChannels) : [];
    } catch {
      return [];
    }
  });

  const [currentRoute, setCurrentRouteState] = useState<ScreenRoute>({ type: 'chat_list' });

  // Android hardware/gesture back and browser navigation support
  const navigateTo = useCallback((route: ScreenRoute) => {
    setCurrentRouteState(route);
    if (route.type !== 'chat_list') {
      try {
        window.history.pushState({ route }, '');
      } catch (e) {
        // ignore
      }
    } else if (window.history.state?.route) {
      try {
        window.history.back();
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const navigateBack = useCallback(() => {
    setCurrentRouteState({ type: 'chat_list' });
    if (window.history.state?.route) {
      try {
        window.history.back();
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Alias for backwards compatibility
  const setCurrentRoute = navigateTo;

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.route) {
        setCurrentRouteState(e.state.route);
      } else {
        setCurrentRouteState({ type: 'chat_list' });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  
  // Telegram Stories state scoped to current logged-in user
  const [stories, setStories] = useState<Story[]>(() => {
    try {
      const savedAcc = localStorage.getItem(STORAGE_ACCOUNT_KEY);
      const acc = savedAcc ? JSON.parse(savedAcc) : null;
      if (!acc) return [];
      const savedStories = localStorage.getItem(`tege_user_stories_${acc.id}`);
      return savedStories ? JSON.parse(savedStories) : [];
    } catch {
      return [];
    }
  });
  const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);
  const [viewingStoryIndex, setViewingStoryIndex] = useState<number | null>(null);

  // Blacklist / Blocked users state
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>(() => {
    try {
      const savedAcc = localStorage.getItem(STORAGE_ACCOUNT_KEY);
      const acc = savedAcc ? JSON.parse(savedAcc) : null;
      if (!acc) return [];
      return realtimeNetwork.getBlockedUsers(acc.id);
    } catch {
      return [];
    }
  });

  const handleBlockUser = (userToBlock: BlockedUser) => {
    if (!account) return;
    realtimeNetwork.blockUser(account.id, userToBlock);
    setBlockedUsers(realtimeNetwork.getBlockedUsers(account.id));
  };

  const handleUnblockUser = (userId: number) => {
    if (!account) return;
    realtimeNetwork.unblockUser(account.id, userId);
    setBlockedUsers(realtimeNetwork.getBlockedUsers(account.id));
  };

  const [toastNotice, setToastNotice] = useState<string | null>(null);
  const loadedAccountIdRef = useRef<number | null>(account ? account.id : null);

  const showToast = useCallback((msg: string) => {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const t = getT(settings.language);

  // Sync settings with DOM attributes (Dark theme class, text size, and language)
  useEffect(() => {
    const root = document.documentElement;
    if (settings.isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    root.setAttribute('data-text-size', settings.textSize);
    root.setAttribute('lang', settings.language);

    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }, [settings]);

  // When active account changes (login, switch account, logout),
  // load ONLY that account's chats, channels, and stories!
  useEffect(() => {
    if (!account) {
      loadedAccountIdRef.current = null;
      setChats([]);
      setChannels([]);
      setStories([]);
      return;
    }

    try {
      const userChatsRaw = localStorage.getItem(`tege_user_chats_${account.id}`);
      setChats(userChatsRaw ? JSON.parse(userChatsRaw) : []);

      const userChannelsRaw = localStorage.getItem(`tege_user_channels_${account.id}`);
      setChannels(userChannelsRaw ? JSON.parse(userChannelsRaw) : []);

      const userStoriesRaw = localStorage.getItem(`tege_user_stories_${account.id}`);
      setStories(userStoriesRaw ? JSON.parse(userStoriesRaw) : []);

      setBlockedUsers(realtimeNetwork.getBlockedUsers(account.id));
      loadedAccountIdRef.current = account.id;
    } catch {
      setChats([]);
      setChannels([]);
      setStories([]);
      setBlockedUsers([]);
      loadedAccountIdRef.current = account.id;
    }
  }, [account?.id]);

  // Persist chats for current user ONLY (guarded against race condition overwrites)
  useEffect(() => {
    if (!account || loadedAccountIdRef.current !== account.id) return;
    try {
      localStorage.setItem(`tege_user_chats_${account.id}`, JSON.stringify(chats));
    } catch (e) {
      console.warn('Failed to persist user chats:', e);
    }
  }, [chats, account?.id]);

  // Keep phone push attached to whichever account is active on this device
  useEffect(() => {
    if (account?.token) refreshPush(account.token).catch(() => {});
  }, [account?.token]);

  // Persist account & synchronize multi-account presence (active account online, secondary accounts offline)
  useEffect(() => {
    try {
      if (account) {
        localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify(account));
        realtimeNetwork.registerUser(account, true, account.id);
        const allIds = accounts.map((a) => a.id);
        realtimeNetwork.syncMultiAccountsOnline(account.id, allIds);
      } else {
        localStorage.removeItem(STORAGE_ACCOUNT_KEY);
      }
    } catch (e) {
      console.warn('Failed to persist account:', e);
    }
  }, [account, accounts]);

  // Persist channels for current user ONLY
  useEffect(() => {
    if (!account || loadedAccountIdRef.current !== account.id) return;
    try {
      localStorage.setItem(`tege_user_channels_${account.id}`, JSON.stringify(channels));
    } catch (e) {
      console.warn('Failed to persist user channels:', e);
    }
  }, [channels, account?.id]);

  // Persist stories for current user ONLY
  useEffect(() => {
    if (!account || loadedAccountIdRef.current !== account.id) return;
    try {
      localStorage.setItem(`tege_user_stories_${account.id}`, JSON.stringify(stories));
    } catch (e) {
      console.warn('Failed to persist user stories:', e);
    }
  }, [stories, account?.id]);

  const playNotificationSound = useCallback(() => {
    if (!settings.soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }, [settings.soundEnabled]);

  // ===== Server connection =====
  const [, setDirectoryTick] = useState(0);
  const [netStatus, setNetStatus] = useState<ConnectionStatus>(realtimeNetwork.getStatus());
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  useEffect(() => {
    if (account?.token) realtimeNetwork.connect(account);
    else realtimeNetwork.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id, account?.token]);

  useEffect(() => {
    const offDir = realtimeNetwork.subscribeToDirectory(() => {
      setDirectoryTick((n) => n + 1);
      if (account) setBlockedUsers(realtimeNetwork.getBlockedUsers(account.id));
    });
    const offStatus = realtimeNetwork.subscribeToStatus(setNetStatus);
    return () => {
      offDir();
      offStatus();
    };
  }, [account?.id]);

  // only show the "no connection" banner if it lasts a few seconds
  useEffect(() => {
    if (!account || netStatus === 'online') {
      setShowOfflineBanner(false);
      return;
    }
    const timer = setTimeout(() => setShowOfflineBanner(true), 3000);
    return () => clearTimeout(timer);
  }, [netStatus, account?.id]);

  useEffect(() => {
    const ru = settings.language === 'ru';
    const offFail = realtimeNetwork.subscribeToSendFailures((reason) => {
      if (reason === 'blocked') showToast(ru ? '⚠️ Пользователь заблокировал вас' : '⚠️ This user has blocked you');
      else if (reason === 'no_user') showToast(ru ? '⚠️ Получатель не найден' : '⚠️ Recipient not found');
      else if (reason === 'forbidden') showToast(ru ? '⚠️ Нет прав на публикацию' : '⚠️ You are not allowed to post here');
    });
    const offAuth = realtimeNetwork.subscribeToAuthErrors(() => {
      showToast(ru ? 'Сессия истекла — войдите снова' : 'Session expired — please log in again');
      handleLogout();
    });
    return () => {
      offFail();
      offAuth();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.language, showToast]);

  // Tell the server which groups/channels we belong to so their messages are routed to us
  const membershipKey = chats
    .filter((c) => c.type !== 'direct')
    .map((c) => c.id)
    .sort()
    .join(',');
  useEffect(() => {
    if (!account || !membershipKey) return;
    realtimeNetwork.joinChats(membershipKey.split(',').map(Number));
  }, [membershipKey, account?.id]);

  // REALTIME NETWORK LISTENER: Receive messages across tabs & devices in real time
  useEffect(() => {
    if (!account) return;

    // Subscribe to live broadcast events
    const unsubscribe = realtimeNetwork.subscribeToMessages((payload: NetworkMessagePayload) => {
      // Ignore messages sent by ourselves
      if (payload.fromUser.id === account.id) return;

      // The author deleted or edited an already delivered message
      if (payload.action && payload.targetId != null) {
        const group = payload.chatType === 'channel' || payload.chatType === 'group';
        const ru = settings.language === 'ru';
        setChats((prevChats) =>
          prevChats.map((c) => {
            const match = group
              ? c.id === payload.chatId || (!!payload.channelOrGroupName && c.name === payload.channelOrGroupName)
              : c.userId === payload.fromUser.id || c.username?.toLowerCase() === payload.fromUser.username.toLowerCase();
            if (!match) return c;
            const idx = c.messages.findIndex(
              (m) => m.id === payload.targetId && !m.isMine && m.senderId === payload.fromUser.id
            );
            if (idx === -1) return c;
            const target = c.messages[idx];
            if (payload.action === 'delete') {
              const messages = c.messages.filter((_, i) => i !== idx);
              let unread = c.unread;
              if (unread > 0) {
                const incoming = c.messages.filter((m) => !m.isMine);
                if (incoming.length - 1 - incoming.indexOf(target) < unread) unread -= 1;
              }
              return {
                ...c,
                messages,
                unread,
                lastMessage: messagePreview(messages[messages.length - 1], ru),
                ...(c.pinnedMessageId === target.id ? { pinnedMessageId: undefined } : {})
              };
            }
            const newText = String(payload.message?.text ?? '').slice(0, 4096);
            if (!newText) return c;
            const messages = c.messages.map((m, i) => (i === idx ? { ...m, text: newText, edited: true } : m));
            return { ...c, messages, ...(idx === c.messages.length - 1 ? { lastMessage: newText } : {}) };
          })
        );
        return;
      }

      const isTargetUser =
        payload.toUserId === account.id ||
        (payload.toUsername && payload.toUsername.toLowerCase() === account.username.toLowerCase());

      const isChannelOrGroup = payload.chatType === 'channel' || payload.chatType === 'group';

      if (!isTargetUser && !isChannelOrGroup) return;

      const incomingMsg: Message = {
        ...payload.message,
        isMine: false
      };

      setChats((prevChats) => {
        const existingChatIdx = prevChats.findIndex((c) => {
          if (isChannelOrGroup) {
            return c.id === payload.chatId || (payload.channelOrGroupName && c.name === payload.channelOrGroupName);
          }
          return c.userId === payload.fromUser.id || c.username?.toLowerCase() === payload.fromUser.username.toLowerCase();
        });

        if (existingChatIdx !== -1) {
          const currentChat = prevChats[existingChatIdx];
          // already have this exact message (e.g. redelivered after a dropped connection)
          if (
            currentChat.messages.some(
              (m) => m.id === incomingMsg.id && !m.isMine && m.senderId === incomingMsg.senderId
            )
          ) {
            return prevChats;
          }
          const updatedChat = {
            ...currentChat,
            messages: [...currentChat.messages, incomingMsg],
            lastMessage: incomingMsg.text || '📷 Медиафайл',
            time: incomingMsg.time,
            unread: currentChat.unread + 1
          };
          const next = [...prevChats];
          next[existingChatIdx] = updatedChat;
          return next;
        }

        // Auto-create chat if not already present
        if (!isChannelOrGroup) {
          const newChat: Chat = {
            id: payload.fromUser.id,
            type: 'direct',
            userId: payload.fromUser.id,
            username: payload.fromUser.username,
            name: payload.fromUser.name,
            lastMessage: incomingMsg.text || '📷 Медиафайл',
            time: incomingMsg.time,
            unread: 1,
            online: true,
            color: sampleColorForId(payload.fromUser.id),
            avatarUri: payload.fromUser.avatarUri || null,
            messages: [incomingMsg]
          };
          return [newChat, ...prevChats];
        }

        return prevChats;
      });

      playNotificationSound();
    });

    return () => {
      unsubscribe();
    };
  }, [account, playNotificationSound]);

  const updateSettings = (updated: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...updated }));
  };

  const toggleTheme = () => {
    setSettings((prev) => ({ ...prev, isDarkMode: !prev.isDarkMode }));
  };

  // Open or initialize Telegram-style Saved Messages (Избранное)
  const handleOpenSavedMessages = () => {
    if (!account) return;
    const SAVED_ID = 999999;
    setChats((prev) => {
      const existing = prev.find((c) => c.id === SAVED_ID || c.isSavedMessages);
      if (existing) return prev;
      const savedChat: Chat = {
        id: SAVED_ID,
        type: 'direct',
        name: settings.language === 'ru' ? 'Избранное' : 'Saved Messages',
        username: settings.language === 'ru' ? 'Избранное' : 'Saved Messages',
        lastMessage: settings.language === 'ru' ? 'Здесь ваши личные заметки и файлы' : 'Your saved messages and notes',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        unread: 0,
        online: true,
        color: '#2AABEE',
        isSavedMessages: true,
        isPinned: true,
        messages: [
          {
            id: 1,
            text: settings.language === 'ru'
              ? '⭐️ Добро пожаловать в «Избранное»!\n\nСюда можно отправлять заметки, ссылки, файлы, фото или пересылать важные сообщения, чтобы они всегда были под рукой на вашем аккаунте.'
              : '⭐️ Welcome to Saved Messages!\n\nForward messages here to save them, send media and files to store them, or write personal notes.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isMine: false,
            senderName: settings.language === 'ru' ? 'Избранное' : 'Saved Messages'
          }
        ]
      };
      return [savedChat, ...prev];
    });
    setCurrentRoute({ type: 'chat_detail', chatId: SAVED_ID });
  };

  // Auth: Login / Register handler
  const handleLogin = (userAccount: UserAccount) => {
    claimLocalDataFor(userAccount);
    setAccount(userAccount);
    setAccounts((prev) => {
      const filtered = prev.filter((a) => a.id !== userAccount.id);
      const updated = [userAccount, ...filtered].slice(0, MAX_ACCOUNTS);
      try {
        localStorage.setItem(STORAGE_MULTI_ACCOUNTS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    // Add to registered accounts registry
    try {
      let reg: UserAccount[] = [];
      const raw = localStorage.getItem(STORAGE_REGISTERED_KEY);
      if (raw) reg = JSON.parse(raw);
      const idx = reg.findIndex((a) => a.email.toLowerCase() === userAccount.email.toLowerCase());
      if (idx !== -1) {
        reg[idx] = userAccount;
      } else {
        reg.push(userAccount);
      }
      localStorage.setItem(STORAGE_REGISTERED_KEY, JSON.stringify(reg));
    } catch {}
  };

  const handleSwitchAccount = (targetAccount: UserAccount) => {
    if (!targetAccount || (account && targetAccount.id === account.id)) return;

    // 1. Save current active account data & set it offline
    if (account && loadedAccountIdRef.current === account.id) {
      try {
        localStorage.setItem(`tege_user_chats_${account.id}`, JSON.stringify(chats));
        localStorage.setItem(`tege_user_channels_${account.id}`, JSON.stringify(channels));
        localStorage.setItem(`tege_user_stories_${account.id}`, JSON.stringify(stories));
        realtimeNetwork.setUserOnline(account.id, false);
      } catch {}
    }

    // 2. Mark target account online and ensure all other accounts on this device are offline
    realtimeNetwork.setUserOnline(targetAccount.id, true);
    realtimeNetwork.syncMultiAccountsOnline(targetAccount.id, accounts.map((a) => a.id));

    // 3. Load target account data immediately and update loadedAccountIdRef
    try {
      const savedChats = localStorage.getItem(`tege_user_chats_${targetAccount.id}`);
      setChats(savedChats ? JSON.parse(savedChats) : []);
      const savedChannels = localStorage.getItem(`tege_user_channels_${targetAccount.id}`);
      setChannels(savedChannels ? JSON.parse(savedChannels) : []);
      const savedStories = localStorage.getItem(`tege_user_stories_${targetAccount.id}`);
      setStories(savedStories ? JSON.parse(savedStories) : []);
      setBlockedUsers(realtimeNetwork.getBlockedUsers(targetAccount.id));
    } catch {}

    loadedAccountIdRef.current = targetAccount.id;
    setAccount(targetAccount);
    try {
      localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify(targetAccount));
    } catch {}

    setCurrentRoute({ type: 'chat_list' });
  };

  const handleAddAccount = (newAccount: UserAccount) => {
    if (accounts.length >= MAX_ACCOUNTS) {
      return;
    }
    claimLocalDataFor(newAccount);

    // Save current active account data & mark it offline
    if (account && loadedAccountIdRef.current === account.id) {
      try {
        localStorage.setItem(`tege_user_chats_${account.id}`, JSON.stringify(chats));
        localStorage.setItem(`tege_user_channels_${account.id}`, JSON.stringify(channels));
        localStorage.setItem(`tege_user_stories_${account.id}`, JSON.stringify(stories));
        realtimeNetwork.setUserOnline(account.id, false);
      } catch {}
    }

    const updated = [newAccount, ...accounts.filter((a) => a.id !== newAccount.id)].slice(0, MAX_ACCOUNTS);
    setAccounts(updated);
    try {
      localStorage.setItem(STORAGE_MULTI_ACCOUNTS_KEY, JSON.stringify(updated));
      localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify(newAccount));
    } catch {}

    // Add to registered accounts registry so login with password works
    try {
      let reg: UserAccount[] = [];
      const raw = localStorage.getItem(STORAGE_REGISTERED_KEY);
      if (raw) reg = JSON.parse(raw);
      if (!reg.some((a) => a.id === newAccount.id || a.email.toLowerCase() === newAccount.email.toLowerCase())) {
        reg.push(newAccount);
        localStorage.setItem(STORAGE_REGISTERED_KEY, JSON.stringify(reg));
      }
    } catch {}

    // Register new account as online and ensure previous account is offline
    realtimeNetwork.registerUser(newAccount, true, newAccount.id);
    realtimeNetwork.syncMultiAccountsOnline(newAccount.id, updated.map((a) => a.id));

    loadedAccountIdRef.current = newAccount.id;
    setAccount(newAccount);
    setChats([]);
    setChannels([]);
    setStories([]);
    setCurrentRoute({ type: 'chat_list' });
  };

  const handleRemoveAccount = (accountId: number) => {
    const remaining = accounts.filter((a) => a.id !== accountId);
    if (remaining.length === 0) return;
    setAccounts(remaining);
    try {
      localStorage.setItem(STORAGE_MULTI_ACCOUNTS_KEY, JSON.stringify(remaining));
    } catch {}
    if (account && account.id === accountId) {
      handleSwitchAccount(remaining[0]);
    }
  };

  const handleLogout = () => {
    if (account) {
      realtimeNetwork.setUserOnline(account.id, false);
      const remaining = accounts.filter((a) => a.id !== account.id);
      setAccounts(remaining);
      try {
        localStorage.setItem(STORAGE_MULTI_ACCOUNTS_KEY, JSON.stringify(remaining));
      } catch {}
      if (remaining.length > 0) {
        handleSwitchAccount(remaining[0]);
        return;
      }
    }
    loadedAccountIdRef.current = null;
    setAccount(null);
    setAccounts([]);
    setChats([]);
    setChannels([]);
    setStories([]);
    setCurrentRoute({ type: 'chat_list' });
    try {
      localStorage.removeItem(STORAGE_ACCOUNT_KEY);
      localStorage.removeItem(STORAGE_MULTI_ACCOUNTS_KEY);
    } catch {}
  };

  // Password change handler with multi-account & registry sync
  const handleSavePassword = async (newPassword: string) => {
    if (!account) return;
    if (account.token) {
      const ok = await realtimeNetwork.changePassword(account.token, newPassword);
      if (!ok) {
        showToast(settings.language === 'ru' ? 'Не удалось сменить пароль на сервере' : 'Could not change the password on the server');
        return;
      }
    }
    const updated = { ...account, password: newPassword };
    setAccount(updated);
    setAccounts((prev) => {
      const nextAccounts = prev.map((a) => (a.id === updated.id ? updated : a));
      try {
        localStorage.setItem(STORAGE_MULTI_ACCOUNTS_KEY, JSON.stringify(nextAccounts));
      } catch {}
      return nextAccounts;
    });
    try {
      let reg: UserAccount[] = [];
      const raw = localStorage.getItem(STORAGE_REGISTERED_KEY);
      if (raw) reg = JSON.parse(raw);
      const idx = reg.findIndex((a) => a.id === updated.id || a.email.toLowerCase() === updated.email.toLowerCase());
      if (idx !== -1) {
        reg[idx] = updated;
      } else {
        reg.push(updated);
      }
      localStorage.setItem(STORAGE_REGISTERED_KEY, JSON.stringify(reg));
    } catch {}
    showToast(settings.language === 'ru' ? 'Пароль успешно обновлён и сохранён!' : 'Password updated and saved!');
  };

  // Update profile with multi-account & registry sync (note: email cannot be changed!)
  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    if (!account) return;
    const { email: _ignoredEmail, ...safeUpdates } = updated;
    const updatedAccount = {
      ...account,
      ...safeUpdates
    };
    setAccount(updatedAccount);
    setAccounts((prev) => {
      const nextAccounts = prev.map((a) => (a.id === updatedAccount.id ? updatedAccount : a));
      try {
        localStorage.setItem(STORAGE_MULTI_ACCOUNTS_KEY, JSON.stringify(nextAccounts));
      } catch {}
      return nextAccounts;
    });
    realtimeNetwork.registerUser(updatedAccount, true, updatedAccount.id);
    try {
      let reg: UserAccount[] = [];
      const raw = localStorage.getItem(STORAGE_REGISTERED_KEY);
      if (raw) reg = JSON.parse(raw);
      const idx = reg.findIndex((a) => a.id === updatedAccount.id || a.email.toLowerCase() === updatedAccount.email.toLowerCase());
      if (idx !== -1) {
        reg[idx] = updatedAccount;
      } else {
        reg.push(updatedAccount);
      }
      localStorage.setItem(STORAGE_REGISTERED_KEY, JSON.stringify(reg));
    } catch {}
    showToast(settings.language === 'ru' ? 'Профиль успешно сохранён!' : 'Profile successfully saved!');
  };

  // Clear all chats completely for current user
  const handleClearAllChats = () => {
    setChats([]);
    if (account) {
      try {
        localStorage.removeItem(`tege_user_chats_${account.id}`);
      } catch {}
    }
  };

  // Select or initiate chat with a real contact (by ID or @username)
  const handleSelectContactUser = (user: ContactUser) => {
    const existingChat = chats.find(
      (c) =>
        (user.id && c.userId === user.id) ||
        (user.username && c.username?.toLowerCase() === user.username.toLowerCase())
    );

    if (existingChat) {
      setCurrentRoute({ type: 'chat_detail', chatId: existingChat.id });
      return;
    }

    const newChatId = user.id || getNext1122Id();
    const newChat: Chat = {
      id: newChatId,
      type: 'direct',
      userId: user.id || newChatId,
      username: user.username,
      name: user.name,
      lastMessage: '',
      time: settings.language === 'ru' ? 'сейчас' : 'now',
      unread: 0,
      online: user.online,
      color: user.color || sampleColorForId(newChatId),
      avatarUri: user.avatarUri || null,
      messages: []
    };

    setChats((prev) => [newChat, ...prev]);
    setCurrentRoute({ type: 'chat_detail', chatId: newChatId });
  };

  // Send message handler with photo, video, кружочки, audio, files, ShieldBot 18+ filter, and slow mode
  const handleSendMessage = (
    chatId: number,
    text: string,
    attachmentUri?: string | null,
    videoUri?: string | null,
    asChannel?: boolean,
    poll?: Poll,
    replyTo?: MessageReplyInfo,
    videoNoteUri?: string | null,
    audioUri?: string | null,
    fileUri?: string | null,
    fileName?: string,
    fileSize?: string,
    forwardedFrom?: string
  ) => {
    if (!account) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const currentChat = chats.find((c) => c.id === chatId);
    if (!currentChat) return;

    // Check if recipient has blocked current user
    if (currentChat.userId && realtimeNetwork.isBlocked(currentChat.userId, account.id)) {
      showToast(
        settings.language === 'ru'
          ? '⚠️ Невозможно отправить сообщение: данный пользователь заблокировал вас'
          : '⚠️ Cannot send message: this user has blocked you'
      );
      return;
    }

    // ShieldBot: check 18+ material filter if enabled
    if (currentChat.botConfig?.isEnabled && currentChat.botConfig?.delete18Plus) {
      const is18Plus = /porn|xxx|sex|18\+|эротик|порно|секс|член|сиськ|шлюх|хуй|пизд|бляд/i.test(text);
      if (is18Plus) {
        const botWarningMessage: Message = {
          id: Date.now(),
          text: settings.language === 'ru'
            ? '⚠️ Сообщение удалено системным ботом ShieldBot: обнаружен 18+ контент!'
            : '⚠️ Message deleted by ShieldBot: 18+ content detected!',
          time: timeStr,
          isMine: false,
          isSystemBotMessage: true,
          senderName: 'ShieldBot'
        };

        setChats((prevChats) =>
          prevChats.map((c) => {
            if (c.id !== chatId) return c;
            return {
              ...c,
              messages: [...c.messages, botWarningMessage],
              lastMessage: '⚠️ 18+ контент заблокирован ShieldBot',
              time: timeStr
            };
          })
        );
        return;
      }
    }

    const isChannel = currentChat?.type === 'channel';

    // If posting as channel/group or in a channel, use channel/group name as sender
    const shouldPostAsChannel = asChannel || isChannel;
    const senderDisplayName = shouldPostAsChannel ? currentChat?.name : account.name;

    const isVoice = Boolean(audioUri && (fileName === 'Голосовое сообщение' || !fileName?.endsWith('.mp3')));

    const newMessage: Message = {
      id: Date.now(),
      text,
      time: timeStr,
      isMine: true,
      attachmentUri: attachmentUri || null,
      videoUri: videoUri || null,
      videoNoteUri: videoNoteUri || null,
      audioUri: audioUri || null,
      voiceDuration: isVoice ? (fileSize || '0:05') : undefined,
      isVoice,
      fileUri: fileUri || null,
      fileName,
      fileSize,
      senderId: account.id,
      senderName: senderDisplayName,
      asChannel: shouldPostAsChannel,
      poll: poll || undefined,
      replyTo: replyTo || undefined,
      forwardedFrom: forwardedFrom || undefined,
      reactions: {},
      comments: [],
      views: isChannel ? 1 : undefined
    };

    setChats((prevChats) =>
      prevChats.map((c) => {
        if (c.id !== chatId) return c;
        const updatedMessages = [...c.messages, newMessage];
        const lastMsgDesc =
          poll ? (settings.language === 'ru' ? '📊 Опрос: ' + poll.question : '📊 Poll: ' + poll.question) :
          videoNoteUri ? (settings.language === 'ru' ? '⚪ Видеосообщение' : '⚪ Video note') :
          isVoice ? (settings.language === 'ru' ? '🎤 Голосовое сообщение' : '🎤 Voice message') :
          audioUri ? (settings.language === 'ru' ? '🎵 Аудио' : '🎵 Audio') :
          fileUri ? `📁 ${fileName || 'Файл'}` :
          text ||
          (videoUri
            ? settings.language === 'ru' ? '📹 Видео' : '📹 Video'
            : attachmentUri
            ? settings.language === 'ru' ? '📷 Фото' : '📷 Photo'
            : '');

        return {
          ...c,
          messages: updatedMessages,
          lastMessage: lastMsgDesc,
          time: settings.language === 'ru' ? 'сейчас' : 'now',
          lastMessageTimestamps: {
            ...(c.lastMessageTimestamps || {}),
            [account.id]: Date.now()
          }
        };
      })
    );

    // Broadcast across realtime mesh network if not personal Saved Messages chat
    if (chatId !== 999999 && !currentChat?.isSavedMessages) {
      realtimeNetwork.sendMessage({
        id: Date.now(),
        fromUser: {
          id: account.id,
          name: shouldPostAsChannel ? currentChat?.name || account.name : account.name,
          username: account.username,
          avatarUri: shouldPostAsChannel ? currentChat?.avatarUri : account.avatarUri
        },
        toUserId: currentChat?.userId,
        toUsername: currentChat?.username,
        chatId,
        chatType: currentChat?.type || 'direct',
        channelOrGroupName: currentChat?.name,
        message: newMessage
      });
    }
  };

  // Tell the other side that we deleted / edited one of OUR messages
  const sendMessageAction = (chat: Chat, action: 'delete' | 'edit', msg: Message, newText?: string) => {
    if (!account) return;
    const asChannel = chat.type !== 'direct' && Boolean(msg.asChannel);
    realtimeNetwork.sendMessage({
      id: Date.now(),
      fromUser: {
        id: account.id,
        name: asChannel ? chat.name : account.name,
        username: account.username,
        avatarUri: asChannel ? chat.avatarUri : account.avatarUri
      },
      toUserId: chat.userId,
      toUsername: chat.username,
      chatId: chat.id,
      chatType: chat.type || 'direct',
      channelOrGroupName: chat.name,
      message: { id: msg.id, text: newText ?? '', time: '', isMine: true },
      action,
      targetId: msg.id
    });
  };

  const handleDeleteMessage = (chatId: number, messageId: number, forEveryone: boolean) => {
    const chat = chats.find((c) => c.id === chatId);
    const msg = chat?.messages.find((m) => m.id === messageId);
    if (!chat || !msg) return;
    const ru = settings.language === 'ru';
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const messages = c.messages.filter((m) => m.id !== messageId);
        return {
          ...c,
          messages,
          lastMessage: messagePreview(messages[messages.length - 1], ru),
          ...(c.pinnedMessageId === messageId ? { pinnedMessageId: undefined } : {})
        };
      })
    );
    if (forEveryone && msg.isMine && chatId !== 999999 && !chat.isSavedMessages) {
      sendMessageAction(chat, 'delete', msg);
    }
  };

  const handleEditMessage = (chatId: number, messageId: number, newText: string) => {
    const text = newText.trim().slice(0, 4096);
    const chat = chats.find((c) => c.id === chatId);
    const msg = chat?.messages.find((m) => m.id === messageId && m.isMine);
    if (!text || !chat || !msg) return;
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const messages = c.messages.map((m) => (m.id === messageId ? { ...m, text, edited: true } : m));
        const isLast = c.messages[c.messages.length - 1]?.id === messageId;
        return { ...c, messages, ...(isLast ? { lastMessage: text } : {}) };
      })
    );
    if (chatId !== 999999 && !chat.isSavedMessages) sendMessageAction(chat, 'edit', msg, text);
  };

  const handleForwardMessage = (toChatId: number, m: Message, fromName: string) => {
    handleSendMessage(
      toChatId,
      m.text,
      m.attachmentUri,
      m.videoUri,
      false,
      undefined,
      undefined,
      m.videoNoteUri,
      m.audioUri,
      m.fileUri,
      m.fileName,
      m.fileSize,
      m.forwardedFrom || fromName
    );
    showToast(settings.language === 'ru' ? 'Сообщение переслано' : 'Message forwarded');
  };

  // Create chat, group, or channel with Telegram-like settings and non-repeating 1122 ID
  const handleCreateChat = (
    optionsOrName:
      | {
          type: ChatType;
          name: string;
          username?: string;
          isPrivate?: boolean;
          onlyAdminsCanPost?: boolean;
          firstMessage?: string;
        }
      | string,
    usernameOrId?: string,
    firstMsgParam?: string
  ) => {
    if (!account) return;

    let type: ChatType = 'group';
    let name = '';
    let username: string | undefined;
    let isPrivate = false;
    let onlyAdminsCanPost = false;
    let firstMessage: string | undefined;

    if (typeof optionsOrName === 'object' && optionsOrName !== null) {
      type = optionsOrName.type;
      name = optionsOrName.name;
      username = optionsOrName.username;
      isPrivate = Boolean(optionsOrName.isPrivate);
      onlyAdminsCanPost = Boolean(optionsOrName.onlyAdminsCanPost);
      firstMessage = optionsOrName.firstMessage;
    } else {
      name = optionsOrName;
      username = usernameOrId;
      firstMessage = firstMsgParam;
    }

    const id = getNext1122Id(); // Guaranteed non-repeating ID starting with 1122...
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const initialMessages: Message[] = firstMessage
      ? [
          {
            id: Date.now(),
            text: firstMessage,
            time: timeStr,
            isMine: true,
            senderId: account.id,
            senderName: type === 'channel' ? name : account.name,
            asChannel: type === 'channel'
          }
        ]
      : [];

    const isNumericId = username ? /^\d+$/.test(username.replace('#', '')) : false;
    const cleanUsername = username
      ? username.startsWith('@')
        ? username
        : `@${username}`
      : undefined;

    const newChat: Chat = {
      id,
      type,
      userId: isNumericId ? parseInt(username!.replace('#', ''), 10) : undefined,
      username: !isNumericId ? cleanUsername : `@id${username}`,
      name,
      lastMessage: firstMessage || (settings.language === 'ru' ? 'Создано' : 'Created'),
      time: settings.language === 'ru' ? 'сейчас' : 'now',
      unread: 0,
      online: type === 'direct',
      color: sampleColorForId(id),
      avatarUri: null,
      messages: initialMessages,
      isPrivate,
      inviteLink: isPrivate ? `https://tege.im/+join_${type}_${id}_${Math.random().toString(36).substring(2, 7)}` : undefined,
      inviteLinkCreatedAt: Date.now(),
      inviteLinkExpiresAt: Date.now() + 5 * 30 * 24 * 60 * 60 * 1000,
      isOwner: true,
      ownerId: account.id,
      admins: [],
      members: [],
      membersCount: 1,
      onlyAdminsCanPost: type === 'channel' ? true : onlyAdminsCanPost
    };

    setChats((prev) => [newChat, ...prev]);

    // If channel, also add to channels catalog
    if (type === 'channel') {
      const newChannel: Channel = {
        id,
        name,
        description: `${name} on Tege Messenger`,
        subscribersCount: 1,
        avatarUri: null,
        color: sampleColorForId(id),
        isSubscribed: true,
        isPublic: !isPrivate,
        channelLink: cleanUsername || `https://tege.im/+join_${id}`,
        inviteLinkCreatedAt: Date.now(),
        inviteLinkExpiresAt: Date.now() + 5 * 30 * 24 * 60 * 60 * 1000,
        isOwner: true,
        ownerId: account.id
      };
      setChannels((prev) => [newChannel, ...prev]);
      realtimeNetwork.registerChannel(newChannel);
    } else if (type === 'group' && !isPrivate) {
      realtimeNetwork.registerGroup(newChat);
    }

    setCurrentRoute({ type: 'chat_detail', chatId: id });
  };

  // Update channel avatar across channels and active chats
  const handleUpdateChannelAvatar = (channelId: number, avatarUri: string | null) => {
    setChannels((prev) =>
      prev.map((ch) => {
        if (ch.id === channelId) {
          const updated = { ...ch, avatarUri };
          realtimeNetwork.registerChannel(updated);
          return updated;
        }
        return ch;
      })
    );
    setChats((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, avatarUri } : c))
    );
  };

  // Update chat metadata (privacy, admin list, members, settings, avatar)
  const handleUpdateChat = (chatId: number, updated: Partial<Chat>) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, ...updated } : c))
    );
    if (updated.avatarUri !== undefined || updated.name !== undefined) {
      setChannels((prev) =>
        prev.map((ch) => {
          if (ch.id === chatId) {
            const up = {
              ...ch,
              ...(updated.avatarUri !== undefined ? { avatarUri: updated.avatarUri } : {}),
              ...(updated.name !== undefined ? { name: updated.name } : {})
            };
            realtimeNetwork.registerChannel(up);
            return up;
          }
          return ch;
        })
      );
    }
  };

  // Delete chat or channel completely
  const handleDeleteChat = (chatId: number) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    setChannels((prev) => prev.filter((ch) => ch.id !== chatId));
    realtimeNetwork.removeChannel(chatId);
    realtimeNetwork.leaveChat(chatId);
    setCurrentRoute({ type: 'chat_list' });
  };

  // Telegram Stories Handlers
  const handleCreateStory = (story: Story) => {
    setStories((prev) => [story, ...prev]);
  };

  const handleDeleteStory = (storyId: number) => {
    setStories((prev) => prev.filter((s) => s.id !== storyId));
  };

  const handleReactStory = (storyId: number, emoji: string) => {
    setStories((prev) =>
      prev.map((s) => {
        if (s.id !== storyId) return s;
        const currentReactions = s.reactions || {};
        return {
          ...s,
          reactions: {
            ...currentReactions,
            [emoji]: (currentReactions[emoji] || 0) + 1
          }
        };
      })
    );
  };

  const handleReplyToStory = (story: Story, replyText: string) => {
    const recipientUser: ContactUser = {
      id: story.authorId,
      name: story.authorName,
      username: story.authorUsername || `@id${story.authorId}`,
      online: true,
      avatarUri: story.authorAvatarUri
    };
    handleSelectContactUser(recipientUser);
    setTimeout(() => {
      handleSendMessage(story.authorId, `[Ответ на историю]: ${replyText}`);
    }, 200);
  };

  // Clear chat history
  const handleClearHistory = (chatId: number) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, messages: [], lastMessage: '' } : c))
    );
  };

  // Open channel as a chat screen (view posts, react, comment, or post if owner)
  const handleOpenChannelChat = (channel: Channel) => {
    const existing = chats.find((c) => c.id === channel.id);
    if (existing) {
      setCurrentRoute({ type: 'chat_detail', chatId: existing.id });
      return;
    }

    const isOwner = Boolean(channel.isOwner || (channel.ownerId ? channel.ownerId === account?.id : false));
    const newChat: Chat = {
      id: channel.id,
      type: 'channel',
      name: channel.name,
      description: channel.description,
      username: channel.channelLink,
      lastMessage: settings.language === 'ru' ? 'Канал создан' : 'Channel created',
      time: settings.language === 'ru' ? 'сейчас' : 'now',
      unread: 0,
      online: false, // channels never have green online dot
      color: channel.color,
      avatarUri: channel.avatarUri,
      messages: [],
      isPrivate: !channel.isPublic,
      inviteLink: channel.channelLink,
      isOwner,
      ownerId: channel.ownerId || (isOwner ? account?.id : undefined),
      subscribersCount: channel.subscribersCount,
      onlyAdminsCanPost: true
    };

    setChats((prev) => [newChat, ...prev]);
    setCurrentRoute({ type: 'chat_detail', chatId: channel.id });
  };

  // If user is not logged in, show AuthScreen immediately (registration by default)
  if (!account) {
    return (
      <AuthScreen
        language={settings.language}
        onLanguageChange={(lang) => updateSettings({ language: lang })}
        isDarkMode={settings.isDarkMode}
        onToggleTheme={toggleTheme}
        onLogin={handleLogin}
      />
    );
  }

  const isConfiguredHeadVolunteer = ['negr7082@gmail.com', 'mkiatkin1488@gmail.com'].includes(account.email.trim().toLowerCase());
  const effectiveVolunteerRole = account.role && account.role !== 'user' ? account.role : (isConfiguredHeadVolunteer ? 'head_volunteer' : 'user');
  const canOpenVolunteerMenu = effectiveVolunteerRole !== 'user';

  const selectedChat =
    currentRoute.type === 'chat_detail'
      ? chats.find((c) => c.id === currentRoute.chatId) || chats[0]
      : null;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-gray-100 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
      {showOfflineBanner && (
        <div className="fixed top-0 inset-x-0 z-50 px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold text-center">
          {settings.language === 'ru'
            ? 'Нет связи с сервером — сообщения отправятся, когда соединение вернётся'
            : 'No connection to the server — messages will be sent when it is back'}
        </div>
      )}
      {/* In-app Toast Notification */}
      {toastNotice && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-zinc-900/95 dark:bg-zinc-800/95 text-white text-xs font-semibold rounded-2xl shadow-2xl border border-white/10 animate-in fade-in slide-in-from-top duration-200">
          {toastNotice}
        </div>
      )}

      {canOpenVolunteerMenu && (
        <button
          type="button"
          onClick={() => setCurrentRoute({ type: 'volunteer' })}
          className="fixed bottom-20 right-4 z-40 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 shadow-xl text-sm font-bold"
        >
          {settings.language === 'ru' ? '🛡 Меню волонтёра' : '🛡 Volunteer menu'}
        </button>
      )}

      {/* Main Responsive App Frame */}
      <div className="flex-1 flex flex-col max-w-6xl mx-auto h-full w-full bg-white dark:bg-zinc-900 shadow-2xl relative overflow-hidden lg:border-x lg:border-gray-200 lg:dark:border-zinc-800">
        {/* Inner App Body */}
        <div className="flex-1 flex overflow-hidden w-full h-full relative">
          {/* Left Side Pane */}
          <aside
            className={`h-full flex-col bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 transition-all ${
              currentRoute.type === 'chat_list'
                ? 'flex w-full lg:w-[380px] lg:shrink-0'
                : 'hidden lg:flex lg:w-[380px] lg:shrink-0'
            }`}
          >
          <div className="flex-1 overflow-hidden">
            <ChatListScreen
              chats={chats}
              channels={channels}
              stories={stories}
              currentUser={account}
              currentUserId={account.id}
              language={settings.language}
              onOpenChat={(chatId) => setCurrentRoute({ type: 'chat_detail', chatId })}
              onOpenProfile={() => setCurrentRoute({ type: 'profile' })}
              onOpenSettings={() => setCurrentRoute({ type: 'settings' })}
              onOpenSavedMessages={handleOpenSavedMessages}
              onOpenChannels={() => setShowDrawer(true)}
              onSelectChannel={handleOpenChannelChat}
              onOpenCreateStory={() => setShowCreateStoryModal(true)}
              onViewStory={(idx) => setViewingStoryIndex(idx)}
              onOpenCreateChat={() => setCurrentRoute({ type: 'create_chat' })}
              onSelectContactUser={handleSelectContactUser}
              isDarkMode={settings.isDarkMode}
              onToggleTheme={toggleTheme}
              accounts={accounts}
              onSwitchAccount={handleSwitchAccount}
            />
          </div>
        </aside>

        {/* Right Side / Active Screen on Mobile */}
        <main
          className={`relative h-full flex-1 min-w-0 flex-col transition-all overflow-hidden ${
            currentRoute.type === 'chat_list' ? 'hidden lg:flex' : 'flex w-full'
          }`}
        >
          {currentRoute.type === 'chat_list' && (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center p-8 bg-gray-50/60 dark:bg-zinc-950/40 select-none">
              <div className="w-20 h-20 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-500 flex items-center justify-center mb-4 shadow-xs">
                <Search className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-zinc-200">
                {t.welcomeToTege}
              </h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-sm mt-1">
                {t.welcomeSub}
              </p>
              <button
                onClick={() => setShowInstallModal(true)}
                className="mt-6 flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-full text-xs font-semibold hover:bg-sky-600 transition"
              >
                <Smartphone className="w-4 h-4" />
                <span>{t.installOnPhone}</span>
              </button>
            </div>
          )}

          {currentRoute.type === 'chat_detail' && selectedChat && (
            <ChatDetailScreen
              chat={selectedChat}
              currentAccount={account}
              wallpaper={settings.wallpaper}
              language={settings.language}
              onBack={navigateBack}
              onOpenProfile={() => setCurrentRoute({ type: 'profile' })}
              onOpenSettings={() => setCurrentRoute({ type: 'settings' })}
              onOpenChannel={handleOpenChannelChat}
              stories={stories}
              onViewStory={(idx) => setViewingStoryIndex(idx)}
              onSendMessage={handleSendMessage}
              onDeleteMessage={handleDeleteMessage}
              onEditMessage={handleEditMessage}
              onForwardMessage={handleForwardMessage}
              forwardTargets={chats}
              onUpdateChat={handleUpdateChat}
              onClearHistory={handleClearHistory}
              onDeleteChat={handleDeleteChat}
              isBlocked={blockedUsers.some((u) => u.id === selectedChat.userId || u.id === selectedChat.id)}
              isBlockedByThem={selectedChat.userId ? realtimeNetwork.isBlocked(selectedChat.userId, account.id) : false}
              onBlockUser={handleBlockUser}
              onUnblockUser={handleUnblockUser}
              isDarkMode={settings.isDarkMode}
              onToggleTheme={toggleTheme}
            />
          )}

          {currentRoute.type === 'profile' && (
            <ProfileScreen
              profile={{
                id: account.id,
                role: effectiveVolunteerRole,
                email: account.email,
                name: account.name,
                username: account.username,
                bio: account.bio,
                avatarUri: account.avatarUri,
                isOnline: account.isOnline
              }}
              language={settings.language}
              channels={channels}
              stories={stories}
              onUpdateProfile={handleUpdateProfile}
              onClearAllChats={handleClearAllChats}
              onOpenSettings={() => setCurrentRoute({ type: 'settings' })}
              onOpenChangePassword={() => setShowChangePasswordModal(true)}
              onSelectChannel={handleOpenChannelChat}
              onCreateChannel={() => setCurrentRoute({ type: 'channels' })}
              onDeleteChannel={handleDeleteChat}
              onUpdateChannelAvatar={handleUpdateChannelAvatar}
              onOpenCreateStory={() => setShowCreateStoryModal(true)}
              onViewStory={(idx) => setViewingStoryIndex(idx)}
              onLogout={handleLogout}
              onBack={navigateBack}
              isDarkMode={settings.isDarkMode}
              onToggleTheme={toggleTheme}
            />
          )}

          {currentRoute.type === 'settings' && (
            <SettingsScreen
              settings={settings}
              onUpdateSettings={updateSettings}
              onClearAllChats={handleClearAllChats}
              onLogout={handleLogout}
              onBack={navigateBack}
              blockedUsers={blockedUsers}
              onBlockUser={handleBlockUser}
              onUnblockUser={handleUnblockUser}
              currentUserId={account.id}
              currentUser={account}
              onOpenSavedMessages={handleOpenSavedMessages}
              onOpenProfile={() => setCurrentRoute({ type: 'profile' })}
              onOpenChangePassword={() => setShowChangePasswordModal(true)}
            />
          )}

          {(currentRoute.type === 'settings' || currentRoute.type === 'profile') && (
            <BottomNav
              active={currentRoute.type === 'settings' ? 'settings' : 'profile'}
              language={settings.language}
              user={account}
              onChats={() => setCurrentRoute({ type: 'chat_list' })}
              onContacts={() => setCurrentRoute({ type: 'create_chat' })}
              onSettings={() => setCurrentRoute({ type: 'settings' })}
              onProfile={() => setCurrentRoute({ type: 'profile' })}
            />
          )}

          {currentRoute.type === 'volunteer' && canOpenVolunteerMenu && (
            <VolunteerScreen user={{ ...account, role: effectiveVolunteerRole }} language={settings.language} onBack={navigateBack} />
          )}

          {currentRoute.type === 'channels' && (
            <ChannelsScreen
              channels={channels}
              currentUserId={account.id}
              language={settings.language}
              onUpdateChannels={setChannels}
              onSelectChannel={handleOpenChannelChat}
              onUpdateChannelAvatar={handleUpdateChannelAvatar}
              onBack={navigateBack}
              isDarkMode={settings.isDarkMode}
              onToggleTheme={toggleTheme}
            />
          )}

          {currentRoute.type === 'create_chat' && (
            <CreateChatScreen
              language={settings.language}
              onCreate={handleCreateChat}
              onBack={navigateBack}
              isDarkMode={settings.isDarkMode}
              onToggleTheme={toggleTheme}
            />
          )}
        </main>
      </div>

    </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        currentPasswordHash={account.password || ''}
        language={settings.language}
        onClose={() => setShowChangePasswordModal(false)}
        onSavePassword={handleSavePassword}
      />

      {/* PWA Phone Installation Modal */}
      <PWAInstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

      {/* Telegram Story Creator Modal */}
      {account && (
        <StoryCreatorModal
          isOpen={showCreateStoryModal}
          currentUser={account}
          language={settings.language}
          onClose={() => setShowCreateStoryModal(false)}
          onCreateStory={handleCreateStory}
        />
      )}

      {/* Telegram Story Viewer Modal */}
      {viewingStoryIndex !== null && stories.length > 0 && (
        <StoryViewerModal
          isOpen={viewingStoryIndex !== null}
          stories={stories}
          initialIndex={viewingStoryIndex}
          currentUserId={account?.id}
          language={settings.language}
          onClose={() => setViewingStoryIndex(null)}
          onDeleteStory={handleDeleteStory}
          onReactStory={handleReactStory}
          onReplyToStory={handleReplyToStory}
        />
      )}

      {/* Telegram Slide-out Drawer Menu */}
      {account && (
        <TelegramDrawer
          isOpen={showDrawer}
          currentUser={account}
          allAccounts={accounts}
          maxAccounts={MAX_ACCOUNTS}
          language={settings.language}
          isDarkMode={settings.isDarkMode}
          onClose={() => setShowDrawer(false)}
          onSwitchAccount={handleSwitchAccount}
          onOpenAddAccount={() => setShowAddAccountModal(true)}
          onRemoveAccount={handleRemoveAccount}
          onNavigateToGroupCreate={() => setCurrentRoute({ type: 'create_chat' })}
          onNavigateToChannelCreate={() => setCurrentRoute({ type: 'channels' })}
          onNavigateToChannels={() => setCurrentRoute({ type: 'channels' })}
          onNavigateToProfile={() => setCurrentRoute({ type: 'profile' })}
          onNavigateToSettings={() => setCurrentRoute({ type: 'settings' })}
          onOpenSavedMessages={handleOpenSavedMessages}
          onNavigateToBlacklist={() => setCurrentRoute({ type: 'settings' })}
          onToggleTheme={toggleTheme}
          onOpenInstallModal={() => setShowInstallModal(true)}
        />
      )}

      {/* Add Account Modal (limit 5 accounts) */}
      <AddAccountModal
        isOpen={showAddAccountModal}
        language={settings.language}
        existingAccounts={accounts}
        maxAccounts={MAX_ACCOUNTS}
        onClose={() => setShowAddAccountModal(false)}
        onAddAccount={handleAddAccount}
      />
    </div>
  );
};

export default App;
