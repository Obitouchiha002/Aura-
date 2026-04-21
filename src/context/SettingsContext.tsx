import React, { createContext, useContext, useState, useEffect } from 'react';
import { globalAudio } from '../utils/audio';
import { getAsset, saveAsset } from '../utils/db';

type Language = 'en' | 'hi' | 'hinglish' | 'es' | 'fr' | 'de';
type Music = 'none' | 'ambient' | 'lofi' | 'nature' | 'classical' | 'focus' | 'custom';

interface SettingsContextType {
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
  ttsVoiceURI: string;
  setTtsVoiceURI: (uri: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('hinglish');
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [music, setMusic] = useState<Music>('none');
  const [volume, setVolume] = useState<number>(0.5);
  const [customMusicUrl, setCustomMusicUrl] = useState<string | null>(null);
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [ttsVoiceURI, setTtsVoiceURI] = useState<string>('');

  // Load settings from localStorage and IndexedDB
  useEffect(() => {
    const loadSettings = async () => {
      const saved = localStorage.getItem('aura_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setLanguage(parsed.language || 'hinglish');
        setHapticFeedback(parsed.hapticFeedback ?? true);
        setVibration(parsed.vibration ?? true);
        setMusic(parsed.music || 'none');
        setVolume(parsed.volume ?? 0.5);
        setUserApiKey(parsed.userApiKey || null);
        setTtsVoiceURI(parsed.ttsVoiceURI || '');
      }
      
      const customMusic = await getAsset('custom_music');
      if (customMusic) {
        setCustomMusicUrl(customMusic);
      }
    };
    loadSettings();
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('aura_settings', JSON.stringify({ language, hapticFeedback, vibration, music, volume, userApiKey, ttsVoiceURI }));
    
    globalAudio.setVolume(volume);

    // Handle Music
    if (music === 'none') {
      globalAudio.stop();
    } else {
      globalAudio.play(music as any, customMusicUrl);
    }
  }, [language, hapticFeedback, vibration, music, volume, customMusicUrl, userApiKey, ttsVoiceURI]);

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
      ttsVoiceURI,
      setTtsVoiceURI
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
