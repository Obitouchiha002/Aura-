import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLang } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { Plus, Minus, RotateCcw, Play, Pause } from 'lucide-react';
import { globalAudio } from '../utils/audio';

export default function Focus() {
  const { lang } = useLang();
  const { hapticFeedback } = useSettings();
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'work' | 'breathe'>('work');
  const [workDuration, setWorkDuration] = useState(25 * 60);
  const [breatheDuration, setBreatheDuration] = useState(5 * 60);
  const [timeLeft, setTimeLeft] = useState(workDuration);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [pickerTime, setPickerTime] = useState({ h: 0, m: 25, s: 0 });

  const triggerHaptic = () => {
    if (hapticFeedback && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      globalAudio.beep();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleTimer = () => { triggerHaptic(); setIsActive(!isActive); };
  
  const resetTimer = () => {
    triggerHaptic();
    setIsActive(false);
    setTimeLeft(mode === 'work' ? workDuration : breatheDuration);
  };

  const handleModeChange = (newMode: 'work' | 'breathe') => {
    triggerHaptic();
    setMode(newMode);
    setIsActive(false);
    setTimeLeft(newMode === 'work' ? workDuration : breatheDuration);
  };

  const adjustTime = (seconds: number) => {
    if (isActive) return;
    triggerHaptic();
    const currentDuration = mode === 'work' ? workDuration : breatheDuration;
    const newDuration = Math.max(1, Math.min(24 * 3600, currentDuration + seconds));
    
    if (mode === 'work') setWorkDuration(newDuration);
    else setBreatheDuration(newDuration);
    
    setTimeLeft(newDuration);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const openTimePicker = () => {
    if (isActive) return;
    triggerHaptic();
    const h = Math.floor(timeLeft / 3600);
    const m = Math.floor((timeLeft % 3600) / 60);
    const s = timeLeft % 60;
    setPickerTime({ h, m, s });
    setIsTimePickerOpen(true);
  };

  const savePickerTime = () => {
    triggerHaptic();
    const totalSeconds = pickerTime.h * 3600 + pickerTime.m * 60 + pickerTime.s;
    const finalSeconds = Math.max(1, totalSeconds);
    if (mode === 'work') setWorkDuration(finalSeconds);
    else setBreatheDuration(finalSeconds);
    setTimeLeft(finalSeconds);
    setIsTimePickerOpen(false);
  };

  const totalDuration = mode === 'work' ? workDuration : breatheDuration;
  const progress = 1 - timeLeft / totalDuration;
  const dashoffset = 301.59 - (301.59 * progress);

  // Generate watch ticks
  const ticks = Array.from({ length: 60 }).map((_, i) => {
    const isHour = i % 5 === 0;
    return (
      <line
        key={i}
        x1="50" y1="2" x2="50" y2={isHour ? "6" : "4"}
        transform={`rotate(${i * 6} 50 50)`}
        stroke={isHour ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)"}
        strokeWidth={isHour ? "1" : "0.5"}
      />
    );
  });

  return (
    <div className="flex-1 flex flex-col items-center justify-center pb-6 px-4 overflow-hidden relative">
      {/* Background breathing effect if in breathe mode */}
      {mode === 'breathe' && isActive && (
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.05, 0.2, 0.05] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full bg-aura-red blur-[100px] pointer-events-none"
        />
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="z-10 flex-1 flex flex-col items-center justify-center w-full max-w-xl mx-auto"
      >
        <div className="text-center mb-6 md:mb-8">
          <h1 className="font-display text-3xl md:text-5xl tracking-[0.2em] uppercase mb-2 text-center leading-tight">
            {lang === 'en' ? 'Absolute Focus' : 'परम ध्यान'}
          </h1>
          <p className="text-white/50 tracking-[0.15em] uppercase text-[10px] md:text-xs text-center max-w-sm mx-auto leading-relaxed">
            {lang === 'en' 
              ? 'Eliminate distractions. Channel your inner power.' 
              : 'सभी बाधाओं को मिटा दें। अपनी आंतरिक शक्ति को केंद्रित करें।'}
          </p>
        </div>

        <div className="flex gap-4 mb-6 md:mb-8">
          <button
            onClick={() => handleModeChange('work')}
            className={`px-6 py-2 rounded-full text-[10px] md:text-xs tracking-widest uppercase transition-all ${
              mode === 'work' ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'border border-white/20 text-white/50 hover:text-white'
            }`}
          >
            {lang === 'en' ? 'Deep Work' : 'गहन कार्य'}
          </button>
          <button
            onClick={() => handleModeChange('breathe')}
            className={`px-6 py-2 rounded-full text-[10px] md:text-xs tracking-widest uppercase transition-all ${
              mode === 'breathe' ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'border border-white/20 text-white/50 hover:text-white'
            }`}
          >
            {lang === 'en' ? 'Breathe' : 'श्वास'}
          </button>
        </div>

        {/* Watch Face Timer */}
        <div className="relative flex items-center justify-center w-64 h-64 md:w-80 md:h-80 mb-8 md:mb-10 group">
          {/* Time Adjustment Buttons (Visible when paused) */}
          {!isActive && (
            <>
              <button 
                onClick={() => adjustTime(-60)}
                className="absolute -left-12 md:-left-16 w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 z-20"
              >
                <Minus size={16} />
              </button>
              <button 
                onClick={() => adjustTime(60)}
                className="absolute -right-12 md:-right-16 w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 z-20"
              >
                <Plus size={16} />
              </button>
            </>
          )}

          <div 
            onClick={openTimePicker}
            className={`absolute inset-0 w-full h-full cursor-pointer transition-transform duration-500 ${!isActive ? 'hover:scale-105' : ''}`}
          >
            <svg className="w-full h-full drop-shadow-[0_0_15px_rgba(239,68,68,0.2)]" viewBox="0 0 100 100">
              {/* Watch Ticks */}
              {ticks}
              
              {/* Background Track */}
              <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              
              {/* Progress Circle */}
              <motion.circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="#EF4444"
                strokeWidth="1.5"
                strokeDasharray="301.59"
                strokeDashoffset={dashoffset}
                strokeLinecap="round"
                className="origin-center -rotate-90 transition-all duration-1000 ease-linear"
              />
              
              {/* Pulsing dot at the end of progress */}
              <motion.circle
                cx="50"
                cy="2"
                r="1.5"
                fill="#FFF"
                className="origin-center transition-all duration-1000 ease-linear"
                style={{ rotate: `${(progress) * 360}deg` }}
              />
            </svg>
          </div>
          
          <div className="flex flex-col items-center justify-center pointer-events-none">
            <div className="font-mono text-4xl md:text-6xl tracking-tighter font-light text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
              {formatTime(timeLeft)}
            </div>
            {!isActive && (
              <div className="text-[9px] uppercase tracking-[0.3em] text-white/30 mt-2 absolute bottom-16">
                {lang === 'en' ? 'Tap to Set Custom Time' : 'कस्टम समय सेट करने के लिए टैप करें'}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-6">
          <button
            onClick={toggleTimer}
            className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-aura-red text-black flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_20px_rgba(239,68,68,0.4)]"
          >
            {isActive ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
          </button>
          <button
            onClick={resetTimer}
            className="w-14 h-14 md:w-16 md:h-16 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors text-white/50 hover:text-white"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </motion.div>

      {/* Time Picker Modal */}
      <AnimatePresence>
        {isTimePickerOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <h2 className="text-xl font-display tracking-[0.2em] uppercase text-center mb-8">Set Focus Time</h2>
              
              {/* Visual Watch Face in Picker */}
              <div className="relative w-48 h-48 mx-auto mb-8 flex items-center justify-center border border-white/5 rounded-full bg-white/5">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                  {ticks}
                </svg>
                <div className="z-10 font-mono text-2xl font-light text-white/80">
                  {pickerTime.h.toString().padStart(2, '0')}:{pickerTime.m.toString().padStart(2, '0')}
                </div>
              </div>

              <div className="flex justify-center items-center gap-4 mb-10">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-white/30">Hours</span>
                  <input 
                    type="number" min="0" max="23" 
                    value={pickerTime.h} 
                    onChange={(e) => setPickerTime(p => ({ ...p, h: parseInt(e.target.value) || 0 }))}
                    className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl text-center text-2xl font-mono focus:border-aura-red outline-none transition-colors"
                  />
                </div>
                <span className="text-2xl text-white/20 mt-6">:</span>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-white/30">Mins</span>
                  <input 
                    type="number" min="0" max="59" 
                    value={pickerTime.m} 
                    onChange={(e) => setPickerTime(p => ({ ...p, m: parseInt(e.target.value) || 0 }))}
                    className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl text-center text-2xl font-mono focus:border-aura-red outline-none transition-colors"
                  />
                </div>
                <span className="text-2xl text-white/20 mt-6">:</span>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-white/30">Secs</span>
                  <input 
                    type="number" min="0" max="59" 
                    value={pickerTime.s} 
                    onChange={(e) => setPickerTime(p => ({ ...p, s: parseInt(e.target.value) || 0 }))}
                    className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl text-center text-2xl font-mono focus:border-aura-red outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setIsTimePickerOpen(false)}
                  className="flex-1 py-4 rounded-2xl border border-white/10 text-white/50 uppercase tracking-widest text-xs hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={savePickerTime}
                  className="flex-1 py-4 rounded-2xl bg-aura-red text-black font-bold uppercase tracking-widest text-xs hover:scale-105 transition-transform"
                >
                  Set Time
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
