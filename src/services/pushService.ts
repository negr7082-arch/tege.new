import { getServerUrl } from './realtimeNetwork';

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

const supported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

function keyToBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function post(path: string, body: unknown): Promise<any> {
  try {
    const res = await fetch(getServerUrl() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch {
    return { ok: false, error: 'network' };
  }
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

export async function getPushState(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

/** Must be called from a tap/click (the browser asks for permission). */
export async function enablePush(token: string): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  return (await syncSubscription(token)) ? 'on' : 'off';
}

async function syncSubscription(token: string): Promise<boolean> {
  try {
    const reg = await getRegistration();
    const k = await post('/api/push-key', {});
    if (!k.ok || !k.key) return false;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyToBytes(k.key) as unknown as BufferSource
      });
    }
    const r = await post('/api/push-subscribe', { token, subscription: sub.toJSON() });
    return Boolean(r.ok);
  } catch {
    return false;
  }
}

/** Silent: re-attach this device to the account that is logged in now (no prompt). */
export async function refreshPush(token: string): Promise<void> {
  if (!supported() || Notification.permission !== 'granted') return;
  await syncSubscription(token);
}

export async function disablePush(token: string): Promise<PushState> {
  if (!supported()) return 'unsupported';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await post('/api/push-unsubscribe', { token, endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } catch {
    /* ignore */
  }
  return Notification.permission === 'denied' ? 'denied' : 'off';
}
