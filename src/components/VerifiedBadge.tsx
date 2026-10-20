import React, { useEffect, useRef, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { Language } from '../types';

interface VerifiedBadgeProps {
  language?: Language;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ language = 'ru' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex items-center shrink-0">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-label={language === 'ru' ? 'Подтверждённый аккаунт' : 'Verified account'}
        aria-expanded={open}
        title={language === 'ru' ? 'Подтверждённый аккаунт' : 'Verified account'}
        className="inline-flex items-center justify-center rounded-full text-[#3390ec] hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <BadgeCheck className="w-[19px] h-[19px] fill-[#3390ec] text-white stroke-[2.5]" />
      </button>
      {open && (
        <span
          role="status"
          className="absolute z-50 left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 py-2 shadow-xl text-sm font-medium text-gray-800 dark:text-zinc-100"
        >
          <span className="flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-[#3390ec]" />
            {language === 'ru' ? 'Подтверждённый аккаунт' : 'Verified account'}
          </span>
        </span>
      )}
    </span>
  );
};
