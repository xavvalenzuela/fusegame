import React, { createContext, useContext, useState } from 'react';

interface Settings {
  playerName: string;
  soundEnabled: boolean;
}

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (update: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({
    playerName: 'Player',
    soundEnabled: true,
  });

  function updateSettings(update: Partial<Settings>) {
    setSettings(s => ({ ...s, ...update }));
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
