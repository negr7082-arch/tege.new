import { ChatStreak } from '../types';

export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getYesterdayDateString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTwoDaysAgoDateString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

class StreakManager {
  private getStorageKey(currentUserId: number, otherId: number): string {
    return `tege_streak_${currentUserId}_${otherId}`;
  }

  public getStreak(currentUserId: number, chatId: number, otherUserId?: number): ChatStreak {
    const targetId = otherUserId || chatId;
    const key = this.getStorageKey(currentUserId, targetId);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatStreak;
        // Check for missed day expiration if currently active
        const today = getTodayDateString();
        const yesterday = getYesterdayDateString();
        if (parsed.status === 'active' && parsed.lastStreakDate) {
          // If the last streak date is older than yesterday, the flame has burned out
          if (parsed.lastStreakDate < yesterday) {
            parsed.status = 'burned_out';
            parsed.burnedOutDate = today;
            this.saveStreak(currentUserId, parsed);
          }
        }
        return parsed;
      }
    } catch {}

    const defaultStreak: ChatStreak = {
      chatId,
      userId: targetId,
      chatDaysCount: 1, // Current day of talking
      lastChatDate: getTodayDateString(),
      status: 'locked',
      streakCount: 0,
      lastStreakDate: ''
    };
    this.saveStreak(currentUserId, defaultStreak);
    return defaultStreak;
  }

  public saveStreak(currentUserId: number, streak: ChatStreak): void {
    const targetId = streak.userId || streak.chatId;
    const key = this.getStorageKey(currentUserId, targetId);
    try {
      localStorage.setItem(key, JSON.stringify(streak));
    } catch (e) {
      console.warn('Failed to save streak:', e);
    }
  }

  // Called whenever a user sends or receives a message in a direct chat
  public onMessageExchanged(
    currentUserId: number,
    chatId: number,
    otherUserId?: number
  ): { streak: ChatStreak; notice?: string } {
    const streak = this.getStreak(currentUserId, chatId, otherUserId);
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();
    let notice: string | undefined;

    // 1. Advance communication days counter
    if (streak.lastChatDate !== today) {
      streak.chatDaysCount += 1;
      streak.lastChatDate = today;

      // Unlocks eligibility at 10 days
      if (streak.chatDaysCount >= 10 && streak.status === 'locked') {
        streak.status = 'eligible';
        notice = '🔥 Вы общаетесь уже 10 дней! Теперь можно зажечь взаимный огонёк в профиле собеседника!';
      }
    }

    // 2. If streak is active, maintain or advance it
    if (streak.status === 'active') {
      if (!streak.lastStreakDate) {
        streak.lastStreakDate = today;
        streak.streakCount = Math.max(1, streak.streakCount);
      } else if (streak.lastStreakDate === yesterday) {
        // Consecutive day! +1 to flame streak
        streak.streakCount += 1;
        streak.lastStreakDate = today;
        notice = `🔥 Огонёк продлён! Стрик: ${streak.streakCount} ${this.formatDays(streak.streakCount)} подряд!`;
      } else if (streak.lastStreakDate < yesterday) {
        // Missed a day! Burned out
        streak.status = 'burned_out';
        streak.burnedOutDate = today;
        notice = '💔 Огонёк погас! Вы пропустили день общения. Начните заново!';
      }
    }

    this.saveStreak(currentUserId, streak);
    return { streak, notice };
  }

  // Send request to activate streak (available after 10 days of talking)
  public requestStreak(
    currentUserId: number,
    chatId: number,
    otherUserId?: number
  ): ChatStreak {
    const streak = this.getStreak(currentUserId, chatId, otherUserId);
    streak.status = 'pending_approval';
    streak.requestedByUserId = currentUserId;
    this.saveStreak(currentUserId, streak);
    return streak;
  }

  // Accept streak request
  public acceptStreak(
    currentUserId: number,
    chatId: number,
    otherUserId?: number
  ): ChatStreak {
    const streak = this.getStreak(currentUserId, chatId, otherUserId);
    streak.status = 'active';
    streak.streakCount = Math.max(1, streak.streakCount || 1);
    streak.lastStreakDate = getTodayDateString();
    streak.requestedByUserId = undefined;
    this.saveStreak(currentUserId, streak);
    return streak;
  }

  // Decline streak request
  public declineStreak(
    currentUserId: number,
    chatId: number,
    otherUserId?: number
  ): ChatStreak {
    const streak = this.getStreak(currentUserId, chatId, otherUserId);
    streak.status = 'eligible';
    streak.requestedByUserId = undefined;
    this.saveStreak(currentUserId, streak);
    return streak;
  }

  // Restart after burning out
  public restartStreak(
    currentUserId: number,
    chatId: number,
    otherUserId?: number
  ): ChatStreak {
    const streak = this.getStreak(currentUserId, chatId, otherUserId);
    streak.status = 'active';
    streak.streakCount = 1;
    streak.lastStreakDate = getTodayDateString();
    streak.burnedOutDate = undefined;
    this.saveStreak(currentUserId, streak);
    return streak;
  }

  // Testing & Simulation tools so users can easily test and demonstrate 10-day unlock and burning out:
  public simulateAddChatDay(
    currentUserId: number,
    chatId: number,
    otherUserId?: number
  ): ChatStreak {
    const streak = this.getStreak(currentUserId, chatId, otherUserId);
    streak.chatDaysCount += 1;
    if (streak.chatDaysCount >= 10 && streak.status === 'locked') {
      streak.status = 'eligible';
    }
    this.saveStreak(currentUserId, streak);
    return streak;
  }

  public simulateSet10Days(
    currentUserId: number,
    chatId: number,
    otherUserId?: number
  ): ChatStreak {
    const streak = this.getStreak(currentUserId, chatId, otherUserId);
    streak.chatDaysCount = Math.max(10, streak.chatDaysCount);
    if (streak.status === 'locked') {
      streak.status = 'eligible';
    }
    this.saveStreak(currentUserId, streak);
    return streak;
  }

  public simulatePassDayBurnOut(
    currentUserId: number,
    chatId: number,
    otherUserId?: number
  ): ChatStreak {
    const streak = this.getStreak(currentUserId, chatId, otherUserId);
    streak.status = 'burned_out';
    streak.lastStreakDate = getTwoDaysAgoDateString();
    streak.burnedOutDate = getTodayDateString();
    this.saveStreak(currentUserId, streak);
    return streak;
  }

  public simulateIncrementStreak(
    currentUserId: number,
    chatId: number,
    otherUserId?: number
  ): ChatStreak {
    const streak = this.getStreak(currentUserId, chatId, otherUserId);
    if (streak.status !== 'active') {
      streak.status = 'active';
      streak.streakCount = 1;
    } else {
      streak.streakCount += 1;
    }
    streak.lastStreakDate = getTodayDateString();
    this.saveStreak(currentUserId, streak);
    return streak;
  }

  public formatDays(count: number): string {
    const lastDigit = count % 10;
    const lastTwo = count % 100;
    if (lastTwo >= 11 && lastTwo <= 19) return 'дней';
    if (lastDigit === 1) return 'день';
    if (lastDigit >= 2 && lastDigit <= 4) return 'дня';
    return 'дней';
  }
}

export const streakManager = new StreakManager();
