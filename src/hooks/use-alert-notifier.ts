'use client';

import { useEffect, useRef } from 'react';
import { playAlertChime, showSystemNotification, vibrate } from '@/lib/alerting';
import type { Impact } from '@/lib/domain/types';
import { liveSession, playerShortName } from '@/lib/domain/views';
import { useHittStore } from '@/store/hitt-store';
import { usePrefs } from '@/store/prefs-store';

/**
 * Fires once per new alert-level impact that arrives while this page is open
 * (alerts already present on load are treated as seen).
 */
export function useAlertNotifier(onAlert?: (impact: Impact) => void, url = '/m') {
  const snapshot = useHittStore((s) => s.snapshot);
  const sound = usePrefs((s) => s.sound);
  const seen = useRef<Set<string> | null>(null);
  const callback = useRef(onAlert);
  callback.current = onAlert;

  useEffect(() => {
    if (!snapshot) return;
    const session = liveSession(snapshot);
    const alerts = snapshot.impacts.filter((i) => i.level === 'alert' && i.sessionId === session?.id);
    if (seen.current === null) {
      seen.current = new Set(alerts.map((a) => a.id));
      return;
    }
    const fresh = alerts.filter(
      (a) => !seen.current!.has(a.id) && a.evaluation?.status !== 'resolved' && Date.now() - a.at < 5 * 60_000,
    );
    for (const a of alerts) seen.current.add(a.id);
    for (const alert of fresh) {
      const player = snapshot.players.find((p) => p.id === alert.playerId);
      const who = player ? `#${player.number} ${playerShortName(player)}` : alert.sensorId;
      if (sound) playAlertChime();
      vibrate();
      void showSystemNotification(
        `High-magnitude impact · ${who}`,
        `${Math.round(alert.linearG)} g linear — evaluate before return to play.`,
        url,
        alert.id,
      );
      callback.current?.(alert);
    }
  }, [snapshot, sound, url]);
}
