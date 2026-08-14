import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { globalAudio } from '../utils/audio';
import { getAsset, saveAsset } from '../utils/db';
import { fireHaptic, isHapticsSupported, type Haptic } from '../utils/haptics';

type Language = 'en' | 'hi' | 'hinglish' | 'es' | 'fr' | 'de';
type Theme = 'dark' | 'light';
type Music = 'none' | 'ambient' | 'lofi' | 'nature' | 'classical' | 'focus' | 'custom';

interface SettingsContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  hapticFeedback: boolean;
  setHapticFeedback: (enabled: boolean) => void;
  vibration: boolean;
  setVibration: (enabled: boolean) => void;
  music: Music;
  setMusic: (music: Music) => void;
  volume: number;
  setVolume: (v: number) => void;
  customMusicUrl: string | null;
  setCustomMusicUrl: (url: string | null) => void;
  userApiKey: string | null;
  setUserApiKey: (key: string | null) => void;
  /** Fires a haptic, already gated by the user's two feedback settings. */
  haptic: (kind: Haptic, throttleMs?: number) => void;
  hapticsSupported: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('hinglish');
  const [theme, setTheme] = useState<Theme>('dark');
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [music, setMusic] = useState<Music>('none');
  const [volume, setVolume] = useState<number>(0.5);
  const [customMusicUrl, setCustomMusicUrl] = useState<string | null>(null);
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  // Saved settings are not in state yet on the first render. Persisting before
  // the load finishes writes the defaults straight over what the user chose —
  // which is what used to reset the theme back to dark on every visit.
  const [hydrated, setHydrated] = useState(false);

  // Load settings from localStorage and IndexedDB
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const saved = localStorage.getItem('aura_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setTheme(parsed.theme || 'dark');
          setLanguage(parsed.language || 'hinglish');
          setHapticFeedback(parsed.hapticFeedback ?? true);
          setVibration(parsed.vibration ?? true);
          setMusic(parsed.music || 'none');
          setVolume(parsed.volume ?? 0.5);
          setUserApiKey(parsed.userApiKey || null);
        }
      } catch (e) {
        // Corrupted settings blob — fall back to defaults rather than blocking the app
        console.warn('Could not read saved settings', e);
      }

      try {
        const customMusic = await getAsset('custom_music');
        if (customMusic) {
          setCustomMusicUrl(customMusic);
        }
      } catch (e) {
        console.warn('Could not read saved music', e);
      }

      setHydrated(true);
    };
    loadSettings();
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem('aura_settings', JSON.stringify({ language, hapticFeedback, vibration, music, volume, userApiKey, theme }));
    } catch (e) {
      console.warn('Could not persist settings', e);
    }


    globalAudio.setVolume(volume);
    const isLight = theme === 'light';
    document.body.classList.toggle('light-theme', isLight);
    document.documentElement.classList.toggle('light-theme', isLight);

    // Keep the browser/PWA chrome in step with the in-app theme
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', isLight ? '#F7F7F8' : '#0A0A0A');

    // Handle Music
    if (music === 'none') {
      globalAudio.stop();
    } else {
      globalAudio.play(music as any, customMusicUrl);
    }
  }, [hydrated, language, hapticFeedback, vibration, music, volume, customMusicUrl, userApiKey, theme]);

  // Bound here so no caller has to remember which setting gates which pattern.
  const haptic = useCallback((kind: Haptic, throttleMs = 0) => {
    fireHaptic(kind, { taps: hapticFeedback, alerts: vibration, throttleMs });
  }, [hapticFeedback, vibration]);

  const updateCustomMusic = async (url: string | null) => {
    setCustomMusicUrl(url);
    if (url) {
      await saveAsset('custom_music', url);
    }
  };

  return (
    <SettingsContext.Provider value={{ 
      language, setLanguage, 
      hapticFeedback, setHapticFeedback, 
      vibration, setVibration, 
      music, setMusic, 
      volume, setVolume, 
      customMusicUrl, 
      setCustomMusicUrl: updateCustomMusic,
      userApiKey,
      setUserApiKey,
      theme,
      setTheme,
      haptic,
      hapticsSupported: isHapticsSupported()
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
