import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLang } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { Plus, Minus, RotateCcw, Play, Pause, ArrowLeft } from 'lucide-react';
import { globalAudio } from '../utils/audio';

export default function Focus() {
  const { lang } = useLang();
  const { haptic } = useSettings();
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'work' | 'breathe'>('work');
  const [workDuration, setWorkDuration] = useState(25 * 60);
  const [breatheDuration, setBreatheDuration] = useState(5 * 60);
  const [timeLeft, setTimeLeft] = useState(workDuration);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [pickerTime, setPickerTime] = useState({ h: 0, m: 25, s: 0 });

  const triggerHaptic = () => haptic('select');

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      globalAudio.beep();
      haptic('warning');
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleTimer = () => { haptic('impact'); setIsActive(!isActive); };
  
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

  // Generate watch ticks. The stroke comes from CSS vars so the dial stays
  // visible when the app flips to the light theme.
  const ticks = Array.from({ length: 60 }).map((_, i) => {
    const isHour = i % 5 === 0;
    return (
      <line
        key={i}
        x1="50" y1="2" x2="50" y2={isHour ? "6" : "4"}
        transform={`rotate(${i * 6} 50 50)`}
        stroke={isHour ? 'var(--tick)' : 'var(--tick-dim)'}
        strokeWidth={isHour ? "1" : "0.5"}
      />
    );
  });

  return (
    <div className="flex-1 flex flex-col items-center justify-center pb-6 px-4 overflow-hidden relative">
      {/* Back Button */}
      <div className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-20">
        <button
          onClick={() => { triggerHaptic(); window.location.hash = 'chat'; }}
          className="w-11 h-11 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors rounded-xl hover:bg-surface-2 bg-surface border border-border shadow-soft"
          title={lang === 'en' ? 'Back to Chat' : 'चैट पर वापस जाएं'}
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      {/* Background breathing effect if in breathe mode.
          Painted as a radial gradient rather than a blurred circle. It used to
          be bg-aura-red with blur(100px), and `will-change` was supposed to get
          that rasterised once — but a WebView re-blurs it as the scale climbs
          anyway, and re-blurring 60vw of surface every frame was the single
          most expensive thing on this screen. A gradient is the same soft bloom
          with nothing to re-blur, so the scale is a plain compositor transform. */}
      {mode === 'breathe' && isActive && (
        <div
          className="absolute top-1/2 left-1/2 w-[60vw] h-[60vw] rounded-full pointer-events-none breathe-glow"
          style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 62%)' }}
        />
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="z-10 flex-1 flex flex-col items-center justify-center w-full max-w-xl mx-auto"
      >
        <div className="text-center mb-6 md:mb-8">
          <h1 className="font-display text-[34px] md:text-5xl font-medium tracking-[-0.025em] mb-2.5 text-center leading-tight text-text-primary">
            {lang === 'en' ? 'Absolute Focus' : 'परम ध्यान'}
          </h1>
          <p className="text-text-muted text-[13px] md:text-[14px] text-center max-w-sm mx-auto leading-relaxed">
            {lang === 'en' 
              ? 'Eliminate distractions. Channel your inner power.' 
              : 'सभी बाधाओं को मिटा दें। अपनी आंतरिक शक्ति को केंद्रित करें।'}
          </p>
        </div>

        <div className="flex gap-4 mb-6 md:mb-8">
          <button
            onClick={() => handleModeChange('work')}
            aria-pressed={mode === 'work'}
            className={`min-h-[44px] px-6 rounded-full text-[13px] font-medium tracking-[0.01em] transition-all border shadow-soft ${
              mode === 'work'
                ? 'bg-text-primary text-bg border-transparent font-semibold'
                : 'border-border text-text-muted hover:text-text-primary hover:border-border-strong'
            }`}
          >
            {lang === 'en' ? 'Deep Work' : 'गहन कार्य'}
          </button>
          <button
            onClick={() => handleModeChange('breathe')}
            aria-pressed={mode === 'breathe'}
            className={`min-h-[44px] px-6 rounded-full text-[13px] font-medium tracking-[0.01em] transition-all border shadow-soft ${
              mode === 'breathe'
                ? 'bg-text-primary text-bg border-transparent font-semibold'
                : 'border-border text-text-muted hover:text-text-primary hover:border-border-strong'
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
                className="absolute -left-12 md:-left-16 w-11 h-11 rounded-full border border-border flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 z-20"
              >
                <Minus size={16} />
              </button>
              <button 
                onClick={() => adjustTime(60)}
                className="absolute -right-12 md:-right-16 w-11 h-11 rounded-full border border-border flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 z-20"
              >
                <Plus size={16} />
              </button>
            </>
          )}

          <div 
            onClick={openTimePicker}
            className={`absolute inset-0 w-full h-full cursor-pointer transition-transform duration-500 ${!isActive ? 'hover:scale-105' : ''}`}
          >
            <svg className="w-full h-full" viewBox="0 0 100 100">
              {/* Watch Ticks */}
              {ticks}

              {/* Background Track */}
              <circle cx="50" cy="50" r="48" fill="none" stroke="var(--tick-dim)" strokeWidth="1" />

              {/* Progress Circle */}
              <motion.circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="var(--accent)"
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
                fill="var(--text-primary)"
                className="origin-center transition-all duration-1000 ease-linear"
                style={{ rotate: `${(progress) * 360}deg` }}
              />
            </svg>
          </div>
          
          <div className="flex flex-col items-center justify-center pointer-events-none">
            <div className="font-mono text-4xl md:text-6xl tracking-tighter font-light text-text-primary tabular-nums">
              {formatTime(timeLeft)}
            </div>
            {!isActive && (
              <div className="text-[11px] tracking-[0.08em] text-text-faint mt-2 absolute bottom-16">
                {lang === 'en' ? 'Tap to Set Custom Time' : 'कस्टम समय सेट करने के लिए टैप करें'}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-6">
          <button
            onClick={toggleTimer}
            aria-label={isActive ? (lang === 'en' ? 'Pause timer' : 'रोकें') : (lang === 'en' ? 'Start timer' : 'शुरू करें')}
            className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-aura-red text-on-accent flex items-center justify-center hover:scale-105 transition-transform shadow-[0_8px_30px_var(--accent-wash)]"
          >
            {isActive ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
          </button>
          <button
            onClick={resetTimer}
            aria-label={lang === 'en' ? 'Reset timer' : 'रीसेट करें'}
            className="w-14 h-14 md:w-16 md:h-16 rounded-full border border-border flex items-center justify-center hover:bg-surface-2 transition-colors text-text-muted hover:text-text-primary"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </motion.div>

      {/* Time Picker Modal */}
      <AnimatePresence>
        {isTimePickerOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-scrim backdrop-blur-sm"
            onClick={() => setIsTimePickerOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-elevated border border-border rounded-3xl p-8 shadow-float"
            >
              <h2 className="text-xl font-display tracking-[-0.01em] text-center mb-8 text-text-primary">
                {lang === 'en' ? 'Set Focus Time' : 'समय निर्धारित करें'}
              </h2>
              
              {/* Visual Watch Face in Picker */}
              <div className="relative w-48 h-48 mx-auto mb-8 flex items-center justify-center border border-border rounded-full bg-surface">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                  {ticks}
                </svg>
                <div className="z-10 font-mono text-2xl font-light text-text-body">
                  {pickerTime.h.toString().padStart(2, '0')}:{pickerTime.m.toString().padStart(2, '0')}
                </div>
              </div>

              <div className="flex justify-center items-center gap-4 mb-10">
                {([
                  { key: 'h', label: lang === 'en' ? 'Hours' : 'घंटे', max: 23 },
                  { key: 'm', label: lang === 'en' ? 'Mins' : 'मिनट', max: 59 },
                  { key: 's', label: lang === 'en' ? 'Secs' : 'सेकंड', max: 59 },
                ] as const).map((field, i) => (
                  <React.Fragment key={field.key}>
                    {i > 0 && <span className="text-2xl text-text-faint mt-6">:</span>}
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-text-faint">{field.label}</span>
                      <input
                        type="number"
                        min="0"
                        max={field.max}
                        inputMode="numeric"
                        value={pickerTime[field.key]}
                        onChange={(e) => {
                          // Clamp here — the min/max attributes alone don't stop
                          // someone typing 99 into the hours box.
                          const next = Math.max(0, Math.min(field.max, parseInt(e.target.value, 10) || 0));
                          setPickerTime(p => ({ ...p, [field.key]: next }));
                        }}
                        className="w-16 h-16 bg-surface border border-border rounded-2xl text-center text-2xl font-mono text-text-primary focus:border-aura-red outline-none transition-colors"
                      />
                    </div>
                  </React.Fragment>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setIsTimePickerOpen(false)}
                  className="flex-1 py-4 rounded-2xl border border-border text-text-muted uppercase tracking-widest text-xs hover:bg-surface transition-colors"
                >
                  {lang === 'en' ? 'Cancel' : 'रद्द करें'}
                </button>
                <button
                  onClick={savePickerTime}
                  className="flex-1 py-4 rounded-2xl bg-aura-red text-on-accent font-bold uppercase tracking-widest text-xs hover:scale-105 transition-transform"
                >
                  {lang === 'en' ? 'Set Time' : 'सेट करें'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
