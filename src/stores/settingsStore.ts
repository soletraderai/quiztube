import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '../types';

interface SettingsState {
  settings: Settings;
  setSettings: (settings: Partial<Settings>) => void;
  clearSettings: () => void;
  isConfigured: () => boolean;
}

const defaultSettings: Settings = {
  userName: '',
  language: 'en',
  tutorPersonality: 'PROFESSOR',
  learningStyle: 'visual',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      setSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      clearSettings: () => set({ settings: defaultSettings }),
      isConfigured: () => {
        const { settings } = get();
        return !!settings.userName;
      },
    }),
    {
      name: 'youtube-learning-settings',
    }
  )
);
