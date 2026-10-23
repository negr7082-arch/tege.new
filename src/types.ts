export type Language = 'ru' | 'en';
export type TextSize = 'small' | 'medium' | 'large' | 'xlarge';
export type WallpaperId = 'pattern' | 'dark' | 'emerald' | 'sunset' | 'ocean' | 'minimal';
export type ChatType = 'direct' | 'group' | 'channel';

export interface AppSettings {
  isDarkMode: boolean;
  language: Language;
  textSize: TextSize;
  wallpaper: WallpaperId;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  lastSeenPrivacy?: 'everyone' | 'contacts' | 'nobody';
  photoPrivacy?: 'everyone' | 'contacts' | 'nobody';
  forwardPrivacy?: 'everyone' | 'contacts' | 'nobody';
  callsPrivacy?: 'everyone' | 'contacts' | 'nobody';
  groupsPrivacy?: 'everyone' | 'contacts' | 'nobody';
  autoDeletePeriod?: 'off' | '1d' | '1w' | '1m';
  whoCanMessage?: 'everyone' | 'contacts';
  twoFactorEnabled?: boolean;
  twoFactorPassword?: string;
  animationsEnabled?: boolean;
  blockedUsers?: BlockedUser[];
}

export interface BlockedUser {
  id: number;
  name: string;
  username: string;
  avatarUri?: string | null;
  blockedAt: number;
}

export interface ChatStreak {
  chatId: number;
  userId: number; // other user's id
  chatDaysCount: number; // consecutive/total active chat days (needs 10 to unlock streak)
  lastChatDate: string; // YYYY-MM-DD of last chat
  status: 'locked' | 'eligible' | 'pending_approval' | 'active' | 'burned_out';
  streakCount: number; // number of active streak days (🔥 1, 2, 3...)
  lastStreakDate: string; // YYYY-MM-DD when streak was maintained
  requestedByUserId?: number; // who initiated the streak invitation
  burnedOutDate?: string;
}

export interface GroupVideoChatParticipant {
  id: number;
  name: string;
  avatarUri?: string | null;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isVideoOn?: boolean;
  isScreenSharing?: boolean;
  isHandRaised?: boolean;
  isHost?: boolean;
}

export interface GroupVideoChatInfo {
  isActive: boolean;
  title: string;
  startedAt: number;
  startedById: number;
  startedByName: string;
  participants: GroupVideoChatParticipant[];
}

export interface PollOption {
  id: number;
  text: string;
  votes: number;
  votedUserIds: number[];
}

export interface Poll {
  question: string;
  options: PollOption[];
  totalVotes: number;
  isClosed?: boolean;
  allowsMultiple?: boolean;
}

export interface Comment {
  id: number;
  authorId: number;
  authorName: string;
  authorUsername?: string;
  authorAvatarUri?: string | null;
  text: string;
  time: string;
}

export interface MessageReplyInfo {
  id: number;
  senderName: string;
  text: string;
}

export interface Message {
  id: number;
  text: string;
  time: string;
  isMine: boolean;
  attachmentUri?: string | null;
  videoUri?: string | null;
  videoNoteUri?: string | null; // кружочек (video circle)
  audioUri?: string | null; // голосовое / музыка
  voiceDuration?: string | null; // e.g. "0:14"
  isVoice?: boolean; // true if voice message
  fileUri?: string | null;
  fileName?: string;
  fileSize?: string;
  senderId?: number;
  senderName?: string;
  senderAvatarUri?: string | null;
  asChannel?: boolean;
  isSystemBotMessage?: boolean;
  reactions?: Record<string, number>;
  userReactions?: Record<number, string>;
  views?: number;
  isPinned?: boolean;
  poll?: Poll;
  comments?: Comment[];
  replyTo?: MessageReplyInfo;
  edited?: boolean; // text was changed after sending ("изменено")
  forwardedFrom?: string; // original author when the message was forwarded
}

export interface AdminMember {
  id: number;
  name: string;
  username: string;
  avatarUri?: string | null;
  isOwner?: boolean;
  canChangeInfo?: boolean;
  canPostMessages?: boolean;
  canDeleteMessages?: boolean;
  canBanUsers?: boolean;
  canAddAdmins?: boolean;
  customTitle?: string;
}

export interface ChatPermissions {
  sendMessages: boolean;
  sendPhotos: boolean;
  sendVideos: boolean;
  sendFiles: boolean;
  sendMusic: boolean;
  sendVideoNotes: boolean; // кружочки
  sendPolls: boolean;
  pinMessages: boolean;
  changeChatInfo: boolean;
  startVideoChat?: boolean; // разрешить всем участникам группы запускать видеочат
}

export interface SystemBotConfig {
  isEnabled: boolean;
  botName: string;
  botUsername: string;
  delete18Plus: boolean; // delete 18+ material
  slowModeSeconds: number; // 0, 10, 30, 60, 300 (5 minutes)
  antiSpamLinks: boolean;
}

export interface ContactUser {
  id: number;
  name: string;
  username: string;
  bio?: string;
  phone?: string;
  country?: string;
  registrationDate?: string;
  online: boolean;
  lastSeenAt?: number | null;
  avatarUri?: string | null;
  color?: string;
  role?: 'user' | 'volunteer' | 'senior_volunteer' | 'head_volunteer';
}

export interface Chat {
  id: number;
  type: ChatType; // 'direct' | 'group' | 'channel'
  userId?: number;
  username?: string; // e.g. '@chat_razraba' or '@tege_org'
  name: string;
  description?: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  color: string;
  avatarUri?: string | null;
  messages: Message[];
  isSavedMessages?: boolean; // Telegram-style "Избранное" / Saved Messages personal cloud storage
  
  // Telegram-like group & channel features:
  isPrivate?: boolean; // false = public (@username), true = private (invite link)
  inviteLink?: string; // e.g. t.me/+join_...
  inviteLinkCreatedAt?: number;
  inviteLinkExpiresAt?: number; // 5 months expiration
  isOwner?: boolean;
  ownerId?: number;
  admins?: AdminMember[];
  members?: ContactUser[];
  membersCount?: number;
  subscribersCount?: number;
  onlyAdminsCanPost?: boolean; // in group: only owner/admins can post
  isMuted?: boolean;
  isPinned?: boolean;
  pinnedMessageId?: number;
  allowMedia?: boolean;
  allowPolls?: boolean;
  allowPinning?: boolean;
  streak?: ChatStreak;
  signMessages?: boolean;
  reactionsEnabled?: boolean;
  chatHistoryVisible?: boolean;
  discussionChatId?: number;
  isBlocked?: boolean;
  isBlockedByThem?: boolean;
  permissions?: ChatPermissions;
  botConfig?: SystemBotConfig;
  lastMessageTimestamps?: Record<number, number>; // for slow mode e.g. 5 minutes
  activeVideoChat?: GroupVideoChatInfo;
}

export interface Channel {
  id: number;
  name: string;
  description: string;
  subscribersCount: number;
  avatarUri?: string | null;
  color: string;
  isSubscribed?: boolean;
  isPublic: boolean;
  channelLink?: string;
  inviteLinkCreatedAt?: number;
  inviteLinkExpiresAt?: number; // 5 months expiration
  isOwner?: boolean;
  ownerId?: number;
  admins?: AdminMember[];
  signMessages?: boolean;
  reactionsEnabled?: boolean;
  discussionChatId?: number;
  permissions?: ChatPermissions;
  botConfig?: SystemBotConfig;
  activeVideoChat?: GroupVideoChatInfo;
}

export interface UserAccount {
  id: number;
  email: string;
  password?: string;
  /** session token issued by the Tege server on login/registration */
  token?: string;
  name: string;
  username: string;
  bio: string;
  phone?: string;
  country?: string;
  registrationDate?: string;
  avatarUri?: string | null;
  isOnline?: boolean;
  role?: 'user' | 'volunteer' | 'senior_volunteer' | 'head_volunteer';
}

export interface Story {
  id: number;
  authorId: number;
  authorName: string;
  authorUsername?: string;
  authorAvatarUri?: string | null;
  mediaUri?: string | null;
  text?: string;
  backgroundColor?: string;
  createdAt: number;
  expiresAt: number;
  viewsCount: number;
  reactions?: Record<string, number>;
  userReactions?: Record<number, string>;
  isMine?: boolean;
}

export interface UserProfile {
  id: number;
  role?: 'user' | 'volunteer' | 'senior_volunteer' | 'head_volunteer';
  email: string;
  name: string;
  username: string;
  bio: string;
  phone?: string;
  country?: string;
  registrationDate?: string;
  avatarUri?: string | null;
  isOnline?: boolean;
}

export type ScreenRoute = 
  | { type: 'chat_list' }
  | { type: 'chat_detail'; chatId: number }
  | { type: 'profile' }
  | { type: 'channels' }
  | { type: 'create_chat' }
  | { type: 'settings' }
  | { type: 'volunteer' };
