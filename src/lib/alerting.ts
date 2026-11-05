'use client';

/**
 * Local alerting: a two-tone chime (Web Audio, no asset), vibration where
 * supported, and a system notification when permission has been granted.
 * Notifications go through the service worker when one is registered so they
 * also work on Android Chrome and installed iOS home-screen apps.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Browsers only allow audio after a user gesture — call this from one. */
export function primeAudio() {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume();
}

export function playAlertChime() {
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const start = c.currentTime + 0.02;
  [0, 0.28, 0.56].forEach((offset, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = i % 2 === 0 ? 880 : 660;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.18, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.24);
    osc.connect(gain).connect(c.destination);
    osc.start(start + offset);
    osc.stop(start + offset + 0.26);
  });
}

export function vibrate() {
  try {
    navigator.vibrate?.([220, 90, 220, 90, 400]);
  } catch {
    // unsupported
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export async function showSystemNotification(title: string, body: string, url: string, tag: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body,
    tag,
    requireInteraction: true,
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    // fall through
  }
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      window.location.href = url;
    };
  } catch {
    // Some mobile browsers only allow service-worker notifications.
  }
}
