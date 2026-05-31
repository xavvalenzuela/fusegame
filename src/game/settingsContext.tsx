import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@starfuse_settings';

interface Settings {
  playerName: string;
  soundEnabled: boolean;
}

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (update: Partial<Settings>) => void;
}

const DEFAULTS: Settings = { playerName: 'Player', soundEnabled: true };

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        setSettings(s => ({ ...s, ...saved }));
      } catch {}
    });
  }, []);

  function updateSettings(update: Partial<Settings>) {
    setSettings(s => {
      const next = { ...s, ...update };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
