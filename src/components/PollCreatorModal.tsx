import React, { useState } from 'react';
import { Poll } from '../types';
import { BarChart2, Plus, Trash2, X, Check } from 'lucide-react';

interface PollCreatorModalProps {
  isOpen: boolean;
  language: 'ru' | 'en';
  onClose: () => void;
  onCreatePoll: (poll: Poll) => void;
}

export const PollCreatorModal: React.FC<PollCreatorModalProps> = ({
  isOpen,
  language,
  onClose,
  onCreatePoll
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowsMultiple, setAllowsMultiple] = useState(false);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const validOptions = options.map((opt) => opt.trim()).filter(Boolean);
    if (validOptions.length < 2) return;

    const poll: Poll = {
      question: question.trim(),
      totalVotes: 0,
      allowsMultiple,
      options: validOptions.map((text, idx) => ({
        id: idx + 1,
        text,
        votes: 0,
        votedUserIds: []
      }))
    };

    onCreatePoll(poll);
    setQuestion('');
    setOptions(['', '']);
    setAllowsMultiple(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in select-none">
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
              {language === 'ru' ? 'Новый опрос' : 'New Poll'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              {language === 'ru' ? 'Для группы или канала в стиле TEGE' : 'TEGE style interactive poll'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Poll Question */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              {language === 'ru' ? 'Вопрос' : 'Question'}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={language === 'ru' ? 'Задайте вопрос...' : 'Ask a question...'}
              className="w-full px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition text-sm font-medium"
            />
          </div>

          {/* Poll Options */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              {language === 'ru' ? 'Варианты ответа' : 'Poll Options'}
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {options.map((option, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 w-4 text-center">{idx + 1}.</span>
                  <input
                    type="text"
                    required
                    value={option}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`${language === 'ru' ? 'Вариант' : 'Option'} ${idx + 1}`}
                    className="flex-1 px-3.5 py-2 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition text-sm"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 text-gray-400 hover:text-rose-500 transition rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-2.5 text-xs text-sky-500 hover:text-sky-600 font-semibold flex items-center gap-1.5 transition px-2 py-1 hover:bg-sky-50 dark:hover:bg-sky-950/30 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'ru' ? 'Добавить вариант' : 'Add Option'}</span>
              </button>
            )}
          </div>

          {/* Settings: Multiple answers */}
          <div className="p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-2xl border border-gray-100 dark:border-zinc-700/60 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-zinc-100">
                {language === 'ru' ? 'Выбор нескольких ответов' : 'Multiple Answers'}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-zinc-400">
                {language === 'ru' ? 'Участники смогут выбрать несколько пунктов' : 'Voters can pick more than one option'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAllowsMultiple(!allowsMultiple)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                allowsMultiple ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            >
              {language === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!question.trim() || options.filter((o) => o.trim()).length < 2}
              className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{language === 'ru' ? 'Создать опрос' : 'Create Poll'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
