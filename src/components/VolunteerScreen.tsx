import React, { useCallback, useEffect, useState } from 'react';
import { UserAccount, Language } from '../types';
import { realtimeNetwork } from '../services/realtimeNetwork';

type Report = {
  id: string; reporterId: number; targetUserId: number; messageId: string; messageText: string;
  category: string; details: string; status: string; createdAt: number;
  history: Array<{ actorId: number; actorRole: string; action: string; createdAt: number; note?: string }>;
};
type MutedUser = { id: number; name: string; username: string; permanent: boolean; until: number | null; reason: string };

interface VolunteerScreenProps {
  user: UserAccount;
  language: Language;
  onBack: () => void;
}
const dateText = (value: number, language: Language) => new Date(value).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US');
const categoryText = (category: string, ru: boolean) => {
  const names: Record<string, string> = { spam: ru ? 'Спам' : 'Spam', adult: ru ? '18+' : 'Adult content', harassment: ru ? 'Травля' : 'Harassment', violence: ru ? 'Насилие' : 'Violence', scam: ru ? 'Мошенничество' : 'Scam', other: ru ? 'Другое' : 'Other' };
  return names[category] || category;
};
export const VolunteerScreen: React.FC<VolunteerScreenProps> = ({ user, language, onBack }) => {
  const ru = language === 'ru';
  const role = user.role || 'user';
  const senior = role === 'senior_volunteer' || role === 'head_volunteer';
  const [reports, setReports] = useState<Report[]>([]);
  const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'reports' | 'muted'>('reports');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hours, setHours] = useState<Record<number, number>>({});
  const token = user.token || '';

  const refresh = useCallback(async () => {
    if (!token || role === 'user') { setLoading(false); setError(ru ? 'Нет доступа к меню волонтёра.' : 'Volunteer access required.'); return; }
    setLoading(true);
    const [reportResult, moderationResult] = await Promise.all([
      realtimeNetwork.getSecurityReports(token),
      realtimeNetwork.getModerationQueue(token)
    ]);
    if (!reportResult.ok) setError(ru ? 'Не удалось загрузить жалобы. Проверь роль аккаунта и подключение к серверу.' : 'Could not load reports. Check account role and server connection.');
    else setError('');
    setReports(reportResult.reports || []);
    if (moderationResult.ok) setMutedUsers(moderationResult.mutedUsers || []);
    setLoading(false);
  }, [token, role, ru]);

  useEffect(() => { void refresh(); }, [refresh]);

  const reportAction = async (report: Report, action: 'review' | 'forward' | 'resolve') => {
    setBusy(report.id); setError(''); setNotice('');
    const result = await realtimeNetwork.actOnSecurityReport(token, report.id, action, notes[report.id] || '');
    if (!result.ok) setError((ru ? 'Действие не выполнено: ' : 'Action failed: ') + (result.error || 'unknown'));
    else { setNotice(ru ? 'Жалоба обновлена.' : 'Report updated.'); await refresh(); }
    setBusy('');
  };
  const moderationAction = async (target: MutedUser, action: 'unmute' | 'extend') => {
    setBusy(String(target.id)); setError(''); setNotice('');
    const result = await realtimeNetwork.moderateSecurity(token, target.id, action, { hours: hours[target.id] || 24 });
    if (!result.ok) setError((ru ? 'Действие не выполнено: ' : 'Action failed: ') + (result.error || 'unknown'));
    else { setNotice(ru ? 'Модерация обновлена.' : 'Moderation updated.'); await refresh(); }
    setBusy('');
  };

  if (role === 'user') return <section className="flex-1 p-6"><button onClick={onBack} className="text-sky-600">← {ru ? 'Назад' : 'Back'}</button><p className="mt-6 font-semibold">{ru ? 'Доступ запрещён.' : 'Access denied.'}</p></section>;

  return <section className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 dark:bg-zinc-950">
    <div className="max-w-4xl mx-auto">
      <button onClick={onBack} className="mb-4 text-sm font-semibold text-sky-600">← {ru ? 'Назад' : 'Back'}</button>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div><h1 className="text-2xl font-bold">{ru ? 'Меню волонтёра' : 'Volunteer menu'}</h1><p className="text-sm text-gray-500">{ru ? 'Роль' : 'Role'}: {role === 'head_volunteer' ? (ru ? 'Главный волонтёр' : 'Head volunteer') : role === 'senior_volunteer' ? (ru ? 'Старший волонтёр' : 'Senior volunteer') : (ru ? 'Волонтёр' : 'Volunteer')}</p></div>
        <button onClick={() => void refresh()} className="rounded-xl border px-3 py-2 text-sm font-semibold dark:border-zinc-700">{ru ? 'Обновить' : 'Refresh'}</button>
      </div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('reports')} className={'rounded-xl px-4 py-2 text-sm font-bold ' + (tab === 'reports' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-zinc-900 border dark:border-zinc-700')}>{ru ? 'Жалобы' : 'Reports'} ({reports.length})</button>
        <button onClick={() => setTab('muted')} className={'rounded-xl px-4 py-2 text-sm font-bold ' + (tab === 'muted' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-zinc-900 border dark:border-zinc-700')}>{ru ? 'Активные муты' : 'Active mutes'} ({mutedUsers.length})</button>
      </div>
      {error && <div role="alert" className="mb-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 p-3 text-sm">{error}</div>}
      {notice && <div className="mb-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 p-3 text-sm">{notice}</div>}
      {loading ? <p className="p-6 text-center text-sm text-gray-500">{ru ? 'Загрузка…' : 'Loading…'}</p> : tab === 'reports' ? (
        reports.length === 0 ? <div className="rounded-2xl bg-white dark:bg-zinc-900 p-6 text-center text-sm text-gray-500">{ru ? 'Жалоб пока нет.' : 'No reports yet.'}</div> :
        <div className="space-y-3">{reports.map(report => <article key={report.id} className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex flex-wrap justify-between gap-2"><div className="font-bold">{categoryText(report.category, ru)} · #{report.targetUserId}</div><span className="text-xs rounded-full bg-gray-100 dark:bg-zinc-800 px-2 py-1">{report.status}</span></div>
          <p className="text-xs text-gray-500 mt-1">{dateText(report.createdAt, language)} · {ru ? 'От пользователя' : 'Reported by'} #{report.reporterId}</p>
          <blockquote className="my-3 border-l-2 border-emerald-500 pl-3 text-sm whitespace-pre-wrap break-words">{report.messageText || (ru ? 'Текст сообщения отсутствует' : 'No message text')}</blockquote>
          {report.details && <p className="text-sm mb-3">{ru ? 'Комментарий: ' : 'Details: '}{report.details}</p>}
          {report.history?.length > 0 && <p className="text-xs text-gray-500 mb-3">{ru ? 'История: ' : 'History: '}{report.history.slice(0,3).map(h => h.action + ' · ' + dateText(h.createdAt, language)).join(' / ')}</p>}
          <textarea value={notes[report.id] || ''} onChange={e => setNotes(old => ({ ...old, [report.id]: e.target.value }))} placeholder={ru ? 'Заметка к действию (необязательно)' : 'Action note (optional)'} rows={2} className="w-full rounded-xl border bg-transparent dark:border-zinc-700 p-2 text-sm mb-3" />
          <div className="flex flex-wrap gap-2">
            {role === 'volunteer' && report.status === 'open' && <button disabled={busy === report.id} onClick={() => void reportAction(report,'review')} className="rounded-lg bg-sky-600 text-white px-3 py-2 text-xs font-bold disabled:opacity-50">{ru ? 'Взять в работу' : 'Review'}</button>}
            {role === 'volunteer' && ['open','reviewing'].includes(report.status) && <button disabled={busy === report.id} onClick={() => void reportAction(report,'forward')} className="rounded-lg bg-amber-600 text-white px-3 py-2 text-xs font-bold disabled:opacity-50">{ru ? 'Передать старшим' : 'Forward to seniors'}</button>}
            {senior && report.status !== 'resolved' && <button disabled={busy === report.id} onClick={() => void reportAction(report,'resolve')} className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-xs font-bold disabled:opacity-50">{ru ? 'Закрыть жалобу' : 'Resolve report'}</button>}
          </div>
        </article>)}</div>
      ) : (
        mutedUsers.length === 0 ? <div className="rounded-2xl bg-white dark:bg-zinc-900 p-6 text-center text-sm text-gray-500">{ru ? 'Активных мутов нет.' : 'No active mutes.'}</div> :
        <div className="space-y-3">{mutedUsers.map(target => <article key={target.id} className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="font-bold">{target.name} <span className="font-normal text-sky-500">{target.username.startsWith('@') ? target.username : '@' + target.username}</span></div>
          <p className="text-xs text-gray-500 mt-1">#{target.id} · {target.permanent ? (ru ? 'Навсегда' : 'Permanent') : (ru ? 'До ' : 'Until ') + dateText(target.until || 0, language)}</p>
          <p className="text-sm my-3">{target.reason}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={!senior || busy === String(target.id)} onClick={() => void moderationAction(target,'unmute')} className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-xs font-bold disabled:opacity-40">{ru ? 'Снять мут' : 'Unmute'}</button>
            {!target.permanent && <><select value={hours[target.id] || 24} onChange={e => setHours(old => ({...old,[target.id]:Number(e.target.value)}))} className="rounded-lg border bg-transparent dark:border-zinc-700 px-2 py-2 text-xs"><option value={1}>1 {ru ? 'ч' : 'h'}</option><option value={24}>24 {ru ? 'ч' : 'h'}</option><option value={72}>72 {ru ? 'ч' : 'h'}</option><option value={168}>168 {ru ? 'ч' : 'h'}</option></select><button disabled={busy === String(target.id)} onClick={() => void moderationAction(target,'extend')} className="rounded-lg bg-amber-600 text-white px-3 py-2 text-xs font-bold disabled:opacity-50">{ru ? 'Продлить мут' : 'Extend mute'}</button></>}
          </div>
        </article>)}</div>
      )}
      <p className="text-xs text-gray-500 mt-5">{ru ? 'Доступ к действиям дополнительно проверяется сервером; кнопки не заменяют серверные права.' : 'The server independently enforces permissions; UI controls do not replace server-side authorization.'}</p>
    </div>
  </section>;
};
