import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useMemo } from 'react';
import { Menu, X, Globe, ArrowLeft, MessageSquare, MoreHorizontal } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import Cursor from './Cursor';
import { globalAudio } from '../utils/audio';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang, toggleLang } = useLang();
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(() => {
    try {
      return localStorage.getItem('aura_haptics') !== 'false';
    } catch (e) {
      return true;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('aura_haptics', String(hapticsEnabled));
    } catch (e) {}
  }, [hapticsEnabled]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (!hapticsEnabled || !navigator.vibrate) return;

      const target = e.target as HTMLElement;
      const isClickable = target.closest('button') || target.closest('a') || target.closest('[role="button"]');

      if (isClickable) {
        try {
          navigator.vibrate(15);
        } catch (err) {
          // Ignore if browser blocks it
        }
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, [hapticsEnabled]);

  useEffect(() => {
    if (soundEnabled) {
      try {
        globalAudio.play('drone');
      } catch (error) {
        console.error("Audio playback failed:", error);
        setSoundEnabled(false);
      }
    } else {
      globalAudio.stop();
    }
  }, [soundEnabled]);

  const mainLinks = [
    { path: '/awakening', label: 'Awakening' },
    { path: '/power', label: 'Power' },
    { path: '/inner', label: 'Inner' },
  ];

  const moreLinks = [
    { path: '/mindset', label: 'Mindset' },
    { path: '/challenge', label: 'Challenge' },
    { path: '/rules', label: 'Rules' },
    { path: '/diary', label: 'Diary' },
    { path: '/daily-quote', label: 'Daily Quote' },
  ];

  const allLinks = [...mainLinks, ...moreLinks];

  // Minimalistic Clock
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Generate random particles for the background
  const particles = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * 5,
    }));
  }, []);

  return (
    <div className="min-h-screen bg-aura-black text-aura-white font-sans selection:bg-aura-red selection:text-black relative">
      {/* Minimalistic White Particles Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-50">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 0 }}
            animate={{ 
              opacity: [0, 0.8, 0], 
              y: [0, -200] 
            }}
            transition={{ 
              duration: p.duration, 
              repeat: Infinity, 
              delay: p.delay,
              ease: "linear" 
            }}
            className="absolute rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,1)]"
            style={{ 
              width: p.size * 1.5, 
              height: p.size * 1.5,
              left: `${p.x}vw`,
              top: `${p.y}vh`
            }}
          />
        ))}
      </div>

      <Cursor />
      
      {/* Minimalistic White Clock */}
      {!location.pathname.includes('/inner') && (
        <div className="fixed top-20 right-6 font-mono text-sm tracking-[0.4em] text-white z-50 mix-blend-difference pointer-events-none flex items-center gap-2">
          <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
          {time.toLocaleTimeString('en-US', { hour12: false })}
        </div>
      )}

      {/* Floating Chat Shortcut */}
      {!location.pathname.includes('/inner') && (
        <Link
          to="/inner"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-aura-red text-black rounded-full font-bold text-[10px] md:text-xs tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:scale-105 hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-all"
        >
          <MessageSquare size={16} />
          <span className="hidden sm:inline">{lang === 'en' ? 'Inner Voice' : 'अंतर्मन'}</span>
        </Link>
      )}

      {location.pathname !== '/' && (
        <>
          <nav className="fixed top-0 left-0 w-full p-6 z-50 flex justify-between items-center mix-blend-difference">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => {
                  if (window.history.state && window.history.state.idx > 0) {
                    navigate(-1);
                  } else {
                    navigate('/');
                  }
                }}
                className="p-2 hover:text-aura-red transition-colors duration-300 opacity-70 hover:opacity-100"
                aria-label="Go back"
              >
                <ArrowLeft size={24} />
              </button>
              <Link to="/" className="font-display font-bold text-xl tracking-widest hover:text-aura-red transition-colors duration-300">
                AURA
              </Link>
            </div>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex gap-6 text-sm tracking-widest uppercase opacity-70 items-center relative">
              {mainLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`transition-all duration-300 ${
                    location.pathname === link.path
                      ? 'text-aura-red opacity-100'
                      : 'hover:text-aura-red hover:opacity-100'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              
              {/* 3 Dots Menu */}
              <div className="relative">
                <button 
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  className={`p-1 transition-colors ${moreMenuOpen ? 'text-aura-red opacity-100' : 'hover:text-aura-red hover:opacity-100'}`}
                >
                  <MoreHorizontal size={20} />
                </button>
                
                <AnimatePresence>
                  {moreMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full right-0 mt-4 w-48 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col"
                    >
                      {moreLinks.map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={() => setMoreMenuOpen(false)}
                          className={`px-4 py-3 text-xs tracking-widest transition-colors border-b border-white/5 last:border-none ${
                            location.pathname === link.path
                              ? 'bg-white/10 text-aura-red'
                              : 'hover:bg-white/5 hover:text-aura-red'
                          }`}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="w-px h-4 bg-white/20 mx-2" />
              
              <button 
                onClick={toggleLang}
                className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-50 hover:opacity-100 hover:text-aura-red transition-all"
              >
                <Globe size={14} /> {lang.toUpperCase()}
              </button>
              
              <button 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="text-xs uppercase tracking-[0.2em] opacity-50 hover:opacity-100 hover:text-aura-red transition-all"
              >
                BGM: {soundEnabled ? 'ON' : 'OFF'}
              </button>

              <button 
                onClick={() => setHapticsEnabled(!hapticsEnabled)}
                className="text-xs uppercase tracking-[0.2em] opacity-50 hover:opacity-100 hover:text-aura-red transition-all"
              >
                HAPTICS: {hapticsEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden text-white opacity-70 hover:opacity-100 hover:text-aura-red transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </nav>
        </>
      )}

      {/* Mobile Fullscreen Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: '-100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '-100%' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 bg-black z-40 flex flex-col items-center justify-center space-y-8"
          >
            {allLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`font-display text-2xl tracking-widest uppercase transition-all duration-300 ${
                  location.pathname === link.path
                    ? 'text-aura-red'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
            
            <div className="flex gap-8 mt-12 border-t border-white/10 pt-8">
              <button 
                onClick={toggleLang}
                className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-white/50 hover:text-white transition-all"
              >
                <Globe size={16} /> {lang === 'en' ? 'HINDI' : 'ENGLISH'}
              </button>
              
              <button 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="text-sm uppercase tracking-[0.2em] text-white/50 hover:text-white transition-all"
              >
                BGM: {soundEnabled ? 'ON' : 'OFF'}
              </button>

              <button 
                onClick={() => setHapticsEnabled(!hapticsEnabled)}
                className="text-sm uppercase tracking-[0.2em] text-white/50 hover:text-white transition-all"
              >
                HAPTICS: {hapticsEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen relative z-10"
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
