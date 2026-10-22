import React, { useEffect, useState } from 'react';
import { Message, Comment, Language, UserAccount } from '../types';
import { MessageSquare, Send, X, Shield, User } from 'lucide-react';
import { realtimeNetwork } from '../services/realtimeNetwork';

interface CommentsModalProps {
  isOpen: boolean;
  post: Message | null;
  channelId: number;
  channelName: string;
  currentAccount: UserAccount;
  language: Language;
  onClose: () => void;
  onAddComment: (postId: number, comment: Comment) => void;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({
  isOpen,
  post,
  channelId,
  channelName,
  currentAccount,
  language,
  onClose,
  onAddComment
}) => {
  const [commentText, setCommentText] = useState('');
  const [serverComments, setServerComments] = useState<Comment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setServerComments(null);
    setCommentError(null);
    if (isOpen && post && currentAccount.token) {
      setCommentsLoading(true);
      void realtimeNetwork.getChannelComments(currentAccount.token, channelId, post.id).then((result) => {
        if (cancelled) return;
        if (result.ok) setServerComments(result.comments);
        else setCommentError(result.error === 'forbidden'
          ? (language === 'ru' ? 'Нет доступа к обсуждению этого канала.' : 'You cannot access this discussion.')
          : (language === 'ru' ? 'Не удалось загрузить комментарии.' : 'Could not load comments.'));
      }).finally(() => { if (!cancelled) setCommentsLoading(false); });
    }
    return () => { cancelled = true; };
  }, [isOpen, post?.id, channelId, currentAccount.token, language]);

  if (!isOpen || !post) return null;

  const comments = serverComments ?? post.comments ?? [];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || commentBusy) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newComment: Comment = {
      id: Date.now(),
      authorId: currentAccount.id,
      authorName: currentAccount.name,
      authorUsername: currentAccount.username,
      authorAvatarUri: currentAccount.avatarUri,
      text: commentText.trim(),
      time: timeStr
    };

    setCommentError(null);
    if (currentAccount.token) {
      setCommentBusy(true);
      const result = await realtimeNetwork.addChannelComment(currentAccount.token, channelId, post.id, commentText.trim());
      setCommentBusy(false);
      if (!result.ok || !result.comment) {
        setCommentError(result.error === 'comment_rate_limited'
          ? (language === 'ru' ? 'Слишком часто. Подождите немного.' : 'You are commenting too quickly. Please wait.')
          : (language === 'ru' ? 'Не удалось отправить комментарий.' : 'Could not send comment.'));
        return;
      }
      onAddComment(post.id, result.comment);
      setServerComments(result.comments);
    } else {
      onAddComment(post.id, newComment);
    }
    setCommentText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in select-none">
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                {language === 'ru' ? 'Обсуждение публикации' : 'Post Discussion'}
              </h3>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500">
                {channelName} • {comments.length} {language === 'ru' ? 'комментариев' : 'comments'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Post Snippet */}
        <div className="bg-gray-50 dark:bg-zinc-800/50 p-3.5 border-b border-gray-100 dark:border-zinc-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 block mb-1">
            {language === 'ru' ? 'Исходный пост' : 'Original Post'}
          </span>
          <p className="text-xs text-gray-700 dark:text-zinc-300 line-clamp-2 italic">
            "{post.text || (post.attachmentUri ? '📷 Фото' : '📹 Видео')}"
          </p>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {commentsLoading && <p className="text-center text-xs text-gray-400 py-3">{language === 'ru' ? 'Загрузка комментариев…' : 'Loading comments…'}</p>}
          {commentError && <p role="alert" className="text-xs text-rose-500 px-2">{commentError}</p>}
          {!commentsLoading && comments.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-zinc-500 text-xs">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-zinc-600" />
              <p className="font-medium">
                {language === 'ru' ? 'Комментариев пока нет' : 'No comments yet'}
              </p>
              <p className="text-[11px] mt-0.5">
                {language === 'ru' ? 'Будьте первым, кто оставит комментарий!' : 'Be the first to comment!'}
              </p>
            </div>
          ) : !commentsLoading ? (
            comments.map((c) => {
              const isMine = c.authorId === currentAccount.id;
              return (
                <div
                  key={c.id}
                  className="flex items-start gap-2.5 p-3 rounded-2xl bg-gray-50 dark:bg-zinc-800/80 border border-gray-100 dark:border-zinc-700/50"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                    {c.authorAvatarUri ? (
                      <img src={c.authorAvatarUri} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      c.authorName.slice(0, 1).toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-bold text-gray-900 dark:text-zinc-100 truncate">
                          {c.authorName}
                        </span>
                        {c.authorUsername && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            {c.authorUsername}
                          </span>
                        )}
                        {isMine && (
                          <span className="text-[9px] px-1 bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-300 rounded font-semibold">
                            Вы
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">{c.time}</span>
                    </div>

                    <p className="text-xs text-gray-800 dark:text-zinc-200 mt-1 break-words select-text">
                      {c.text}
                    </p>
                  </div>
                </div>
              );
            })
          ) : null}
        </div>

        {/* New Comment Input */}
        <form onSubmit={handleSend} className="p-3 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={language === 'ru' ? 'Написать комментарий...' : 'Write a comment...'}
            className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 text-xs rounded-full outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || commentBusy}
            className="w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white flex items-center justify-center transition active:scale-95 shadow-md shadow-sky-500/20 shrink-0"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
