import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface Prefs {
  sound: boolean;
  setSound: (sound: boolean) => void;
}

const safeStorage = createJSONStorage(() => {
  try {
    return window.localStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }
});

/** Per-device preferences (not shared across devices). */
export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      sound: true,
      setSound: (sound) => set({ sound }),
    }),
    { name: 'hitt.prefs', storage: safeStorage },
  ),
);
