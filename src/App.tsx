import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Home } from './pages/Home';
import Inner from './pages/Inner';
import Focus from './pages/Focus';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { MouseGlow } from './components/MouseGlow';
import { SpaceBackground } from './components/SpaceBackground';

function AppContent() {
  const [hash, setHash] = useState('');
  const { user, isAdmin, loading } = useAuth();
  const [globalSettings, setGlobalSettings] = useState({ maintenanceMode: false, welcomeMessage: '' });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'global'));
        if (snap.exists()) {
          setGlobalSettings(snap.data() as any);
        }
      } catch (e) {
        console.error(e);
      }
    };
    if (user) {
      fetchSettings();
    }
  }, [user]);

  useEffect(() => {
    // Always start on the home page when the app loads
    if (window.location.hash) {
      window.location.hash = '';
    }

    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-aura-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (globalSettings.maintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h1 className="text-4xl font-serif italic text-aura-red">Maintenance Mode</h1>
        <p className="text-gray-400 max-w-md">The application is currently undergoing maintenance. Please check back later.</p>
      </div>
    );
  }

  if (hash === '#admin' && isAdmin) {
    return <AdminDashboard onBack={() => { window.location.hash = 'chat'; }} />;
  }

  const isChat = hash.startsWith('#chat') || hash.startsWith('#focus') || hash.startsWith('#simulator') || hash.startsWith('#settings') || hash.startsWith('#history') || hash.startsWith('#selector');

  return (
    <>
      {globalSettings.welcomeMessage && !isChat && (
        <div className="fixed top-0 left-0 right-0 bg-aura-red/20 text-aura-red border-b border-aura-red/30 p-2 text-center text-sm z-50 backdrop-blur-md">
          {globalSettings.welcomeMessage}
        </div>
      )}
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
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <SettingsProvider>
          <AppContent />
        </SettingsProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
