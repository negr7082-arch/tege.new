import { Chat, Channel, UserAccount, ContactUser } from './types';

export const sampleColorForId = (id: number): string => {
  switch (Math.abs(Math.floor(id)) % 5) {
    case 0:
      return '#5BA8FF';
    case 1:
      return '#57CC99';
    case 2:
      return '#F8A13C';
    case 3:
      return '#C57AEB';
    default:
      return '#FF6B6B';
  }
};

// Unique ID for groups / channels / stories, starting with 1122 (e.g. 1122483920).
// Random digits keep IDs from colliding between different devices; user IDs are issued by the server.
export const getNext1122Id = (): number => {
  const used = new Set<number>();
  try {
    const raw = localStorage.getItem('tege_used_chat_ids');
    if (raw) (JSON.parse(raw) as number[]).forEach((n) => used.add(n));
  } catch {
    /* ignore */
  }
  let id = 0;
  do {
    id = 1122000000 + Math.floor(Math.random() * 1_000_000);
  } while (used.has(id));
  try {
    used.add(id);
    localStorage.setItem('tege_used_chat_ids', JSON.stringify(Array.from(used).slice(-500)));
  } catch {
    /* ignore */
  }
  return id;
};

// Alias for backwards compatibility
export const getNextUserId = (): number => getNext1122Id();

// Completely empty chat list - only real chats created by user
export const initialSampleChats: Chat[] = [];

// No fake bots or AI personas - only real people registered
export const discoverableUsers: ContactUser[] = [];

export const defaultSampleChannels: Channel[] = [];
