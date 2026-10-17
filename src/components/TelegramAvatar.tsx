import React from 'react';

// Authentic Telegram Avatar Colors
const TELEGRAM_AVATAR_GRADIENTS = [
  { bg: 'from-[#E17076] to-[#FF888E]', solid: '#E17076' }, // Red
  { bg: 'from-[#FAA774] to-[#FFBE94]', solid: '#FAA774' }, // Orange
  { bg: 'from-[#A695E7] to-[#BBAEF0]', solid: '#A695E7' }, // Violet
  { bg: 'from-[#7BC862] to-[#91DE79]', solid: '#7BC862' }, // Green
  { bg: 'from-[#6EC9CB] to-[#86E0E2]', solid: '#6EC9CB' }, // Cyan
  { bg: 'from-[#65AADD] to-[#7DC0F2]', solid: '#65AADD' }, // Blue
  { bg: 'from-[#EE7AAE] to-[#FA95C1]', solid: '#EE7AAE' }  // Pink
];

export function getTelegramLetter(name?: string | null): string {
  if (!name) return '?';
  const clean = name.trim().replace(/^[@#]+/, '').trim();
  if (!clean) return '?';
  return clean.charAt(0).toUpperCase();
}

export function getTelegramAvatarStyle(idOrName?: number | string | null): { gradient: string; solid: string } {
  let hash = 0;
  if (typeof idOrName === 'number') {
    hash = Math.abs(idOrName);
  } else if (typeof idOrName === 'string') {
    for (let i = 0; i < idOrName.length; i++) {
      hash = (hash << 5) - hash + idOrName.charCodeAt(i);
      hash |= 0;
    }
    hash = Math.abs(hash);
  } else {
    hash = 3;
  }
  const colorIndex = hash % TELEGRAM_AVATAR_GRADIENTS.length;
  return {
    gradient: TELEGRAM_AVATAR_GRADIENTS[colorIndex].bg,
    solid: TELEGRAM_AVATAR_GRADIENTS[colorIndex].solid
  };
}

interface TelegramAvatarProps {
  src?: string | null;
  name?: string | null;
  id?: number | string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isOnline?: boolean;
  showOnlineDot?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-sm',
  md: 'w-11 h-11 text-base',
  lg: 'w-14 h-14 text-xl',
  xl: 'w-20 h-20 text-2xl',
  '2xl': 'w-24 h-24 text-4xl'
};

const dotSizeClasses = {
  xs: 'w-2 h-2 bottom-0 right-0 border',
  sm: 'w-2.5 h-2.5 bottom-0 right-0 border-2',
  md: 'w-3 h-3 bottom-0 right-0 border-2',
  lg: 'w-3.5 h-3.5 bottom-0.5 right-0.5 border-2',
  xl: 'w-4 h-4 bottom-1 right-1 border-2',
  '2xl': 'w-5 h-5 bottom-1 right-1 border-2'
};

export const TelegramAvatar: React.FC<TelegramAvatarProps> = ({
  src,
  name,
  id,
  size = 'md',
  isOnline = false,
  showOnlineDot = false,
  className = '',
  onClick
}) => {
  const letter = getTelegramLetter(name);
  const color = getTelegramAvatarStyle(id || name);
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const dotSizeClass = dotSizeClasses[size] || dotSizeClasses.md;

  return (
    <div
      onClick={onClick}
      className={`relative shrink-0 select-none ${className} ${onClick ? 'cursor-pointer' : ''}`}
    >
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className={`${sizeClass} rounded-full object-cover shadow-xs border border-black/5 dark:border-white/5`}
        />
      ) : (
        <div
          className={`${sizeClass} rounded-full bg-gradient-to-br ${color.gradient} text-white font-bold flex items-center justify-center shadow-xs uppercase tracking-tight`}
        >
          <span>{letter}</span>
        </div>
      )}

      {showOnlineDot && (
        <span
          className={`absolute rounded-full border-white dark:border-zinc-900 ${dotSizeClass} ${
            isOnline ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-zinc-500'
          }`}
          title={isOnline ? 'В сети' : 'Не в сети'}
        />
      )}
    </div>
  );
};
