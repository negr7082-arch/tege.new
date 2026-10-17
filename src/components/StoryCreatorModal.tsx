import React, { useState, useRef } from 'react';
import { Story, Language, UserAccount } from '../types';
import { getT } from '../translations';
import {
  X,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Send,
  Palette,
  Check,
  Clock,
  Globe
} from 'lucide-react';

interface StoryCreatorModalProps {
  isOpen: boolean;
  currentUser: UserAccount;
  language: Language;
  onClose: () => void;
  onCreateStory: (story: Story) => void;
}

const PRESET_GRADIENTS = [
  { id: 'sunset', label: 'Sunset', value: 'from-amber-500 via-rose-500 to-purple-600' },
  { id: 'ocean', label: 'Ocean', value: 'from-sky-500 via-blue-600 to-indigo-700' },
  { id: 'emerald', label: 'Emerald', value: 'from-emerald-400 via-teal-600 to-cyan-700' },
  { id: 'violet', label: 'Violet', value: 'from-purple-600 via-fuchsia-600 to-pink-500' },
  { id: 'midnight', label: 'Midnight', value: 'from-zinc-900 via-zinc-800 to-black' }
];

const QUICK_EMOJIS = ['✨', '🔥', '❤️', '🌟', '🚀', '😎', '🎉', '⚡', '☕', '🤙'];

export const StoryCreatorModal: React.FC<StoryCreatorModalProps> = ({
  isOpen,
  currentUser,
  language,
  onClose,
  onCreateStory
}) => {
  const [selectedGradient, setSelectedGradient] = useState(PRESET_GRADIENTS[0].value);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = getT(language);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageUri(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageUri(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePublish = () => {
    if (!imageUri && !caption.trim()) return;

    const newStory: Story = {
      id: Date.now(),
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorUsername: currentUser.username,
      authorAvatarUri: currentUser.avatarUri,
      mediaUri: imageUri,
      text: caption.trim() || undefined,
      backgroundColor: selectedGradient,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      viewsCount: 1,
      reactions: {},
      userReactions: {},
      isMine: true
    };

    onCreateStory(newStory);
    setImageUri(null);
    setCaption('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-sky-500 text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                {language === 'ru' ? 'Новая история' : 'New Story'}
              </h3>
              <p className="text-[11px] text-gray-400">
                {language === 'ru' ? 'TEGE Stories • 24 часа' : 'TEGE Stories • 24 hours'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Preview & Controls */}
        <div className="py-3 flex-1 overflow-y-auto space-y-4">
          {/* Story Frame Preview (9:16 mobile proportion) */}
          <div
            className={`w-full aspect-[9/14] rounded-2xl overflow-hidden relative shadow-lg flex flex-col justify-between p-4 bg-gradient-to-tr ${
              imageUri ? 'bg-zinc-900' : selectedGradient
            }`}
          >
            {/* Background image if loaded */}
            {imageUri && (
              <img
                src={imageUri}
                alt="Story preview"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Dark overlay for contrast */}
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />

            {/* Story Top Info */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {currentUser.avatarUri ? (
                  <img
                    src={currentUser.avatarUri}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-white/80"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs text-white font-bold text-xs flex items-center justify-center ring-2 ring-white/80">
                    {currentUser.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-white drop-shadow-sm">{currentUser.name}</p>
                  <p className="text-[10px] text-white/80 drop-shadow-sm">
                    {language === 'ru' ? 'Только что' : 'Just now'}
                  </p>
                </div>
              </div>

              {imageUri && (
                <button
                  onClick={handleRemoveImage}
                  className="px-2 py-1 bg-black/50 hover:bg-black/70 text-white rounded-lg text-[10px] font-medium backdrop-blur-xs transition"
                >
                  {language === 'ru' ? 'Убрать фото' : 'Remove photo'}
                </button>
              )}
            </div>

            {/* Center / Bottom Caption */}
            <div className="relative z-10">
              {caption ? (
                <div className="bg-black/45 backdrop-blur-md text-white p-3 rounded-xl max-w-full text-center text-sm font-semibold shadow-md border border-white/10 break-words">
                  {caption}
                </div>
              ) : (
                <p className="text-center text-white/50 text-xs italic">
                  {language === 'ru' ? 'Введите текст или выберите фото' : 'Type text or choose a photo'}
                </p>
              )}
            </div>
          </div>

          {/* Media & Color Selectors */}
          <div className="space-y-3">
            {/* Photo buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-zinc-200 flex items-center justify-center gap-2 transition"
              >
                <ImageIcon className="w-4 h-4 text-sky-500" />
                <span>{imageUri ? (language === 'ru' ? 'Сменить фото' : 'Change photo') : (language === 'ru' ? 'Выбрать фото' : 'Upload photo')}</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>

            {/* Background gradient picker (when no photo or photo style) */}
            <div>
              <label className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400 block mb-1.5 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-pink-500" />
                <span>{language === 'ru' ? 'Градиент фона' : 'Background style'}</span>
              </label>
              <div className="flex items-center gap-2">
                {PRESET_GRADIENTS.map((grad) => (
                  <button
                    key={grad.id}
                    onClick={() => {
                      setSelectedGradient(grad.value);
                      if (imageUri) setImageUri(null);
                    }}
                    className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${grad.value} shadow-xs transition transform hover:scale-105 relative flex items-center justify-center ${
                      selectedGradient === grad.value && !imageUri
                        ? 'ring-2 ring-sky-500 scale-105'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    title={grad.label}
                  >
                    {selectedGradient === grad.value && !imageUri && (
                      <Check className="w-4 h-4 text-white drop-shadow-md" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption Input */}
            <div>
              <label className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400 block mb-1">
                {language === 'ru' ? 'Текст истории' : 'Story text'}
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t.storyCaption}
                rows={2}
                maxLength={200}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-zinc-800 rounded-xl text-xs text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              />
            </div>

            {/* Quick Emojis */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setCaption((prev) => (prev ? `${prev} ${emoji}` : emoji))}
                  className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg text-sm shrink-0 transition"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Privacy details */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-zinc-800/50 rounded-xl text-[11px] text-gray-500 dark:text-zinc-400">
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-sky-500" />
                <span>{language === 'ru' ? 'Видно всем в сети' : 'Visible to all'}</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>24 ч</span>
              </span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-3 border-t border-gray-100 dark:border-zinc-800 flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition"
          >
            {t.cancel}
          </button>
          <button
            onClick={handlePublish}
            disabled={!imageUri && !caption.trim()}
            className="flex-1 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/20 active:scale-98 transition"
          >
            <Send className="w-4 h-4" />
            <span>{t.postStory}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
