import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { SettingsProvider } from './context/SettingsContext';
import { useState, useEffect } from 'react';
import { Home } from './pages/Home';
import Inner from './pages/Inner';
import Focus from './pages/Focus';
import { MouseGlow } from './components/MouseGlow';
import { SpaceBackground } from './components/SpaceBackground';

export default function App() {
  const [hash, setHash] = useState('');

  useEffect(() => {
    // Always start on the home page when the app loads
    if (window.location.hash) {
      window.location.hash = '';
    }

    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const isChat = hash.startsWith('#chat') || hash.startsWith('#focus') || hash.startsWith('#simulator') || hash.startsWith('#settings') || hash.startsWith('#history') || hash.startsWith('#selector');

  return (
    <LanguageProvider>
      <SettingsProvider>
        {isChat ? (
          <>
            <SpaceBackground />
            <Inner />
          </>
        ) : (
          <>
            <MouseGlow />
            <Home onEnter={() => { window.location.hash = 'chat'; }} />
          </>
        )}
      </SettingsProvider>
    </LanguageProvider>
  );
}
