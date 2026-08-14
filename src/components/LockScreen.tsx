import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Delete, Fingerprint, Lock } from 'lucide-react';
import { useAppLock } from '../context/AppLockContext';
import { useSettings } from '../context/SettingsContext';
import { PatternPad } from './PatternPad';

/** Blocks the whole app until the code, pattern or biometric checks out. */
export const LockScreen: React.FC = () => {
  const { config, unlock, unlockWithBiometric } = useAppLock();
  const { haptic } = useSettings();

  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const passcodeRef = useRef<HTMLInputElement>(null);

  const method = config?.method ?? 'pin';
  const pinLength = 4;

  const fail = () => {
    haptic('error');
    setError(true);
    setAttempts(a => a + 1);
    // Long enough to actually read before it clears itself.
    setTimeout(() => {
      setError(false);
      setValue('');
      setResetKey(k => k + 1);
    }, 900);
  };

  const attempt = async (secret: string) => {
    if (busy) return;
    setBusy(true);
    const ok = await unlock(secret);
    setBusy(false);
    if (ok) haptic('success');
    else fail();
  };

  // A PIN submits itself the moment it is long enough
  useEffect(() => {
    if (method === 'pin' && value.length === pinLength && !busy) attempt(value);
  }, [value, method, busy]);

  // Offer the sensor straight away — that is the fast path
  useEffect(() => {
    if (config?.biometric && config.credentialId) {
      unlockWithBiometric().then(ok => { if (ok) haptic('success'); });
    }
    if (method === 'passcode') passcodeRef.current?.focus();
  }, []);

  const press = (digit: string) => {
    if (value.length >= pinLength || busy) return;
    haptic('tap');
    setValue(v => v + digit);
  };

  return (
    <div className="fixed inset-0 z-[999] bg-bg flex flex-col items-center justify-center px-6 py-10 overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--accent-wash)_0%,transparent_65%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm flex flex-col items-center"
      >
        <span className="w-14 h-14 rounded-2xl bg-surface border border-border shadow-soft flex items-center justify-center mb-5">
          <Lock size={22} className="text-aura-red" strokeWidth={1.8} />
        </span>

        <span className="flex items-baseline gap-[3px] select-none mb-1.5">
          <span className="font-display font-bold text-[20px] leading-none tracking-[0.09em] uppercase text-text-primary">Aura</span>
          <span className="w-[5px] h-[5px] rounded-full bg-aura-red translate-y-[-1px]" />
        </span>

        <p className="text-[14px] text-text-muted mb-8 text-center">
          {error
            ? (method === 'pattern' ? 'Wrong pattern' : method === 'passcode' ? 'Wrong passcode' : 'Wrong PIN')
            : method === 'pattern' ? 'Draw your pattern'
            : method === 'passcode' ? 'Enter your passcode'
            : 'Enter your PIN'}
        </p>

        {method === 'pin' && (
          <>
            <div className={`flex gap-3.5 mb-9 ${error ? 'animate-pulse' : ''}`}>
              {Array.from({ length: pinLength }).map((_, i) => (
                <span
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border transition-colors ${
                    error ? 'bg-danger border-transparent'
                      : i < value.length ? 'bg-aura-red border-transparent'
                      : 'bg-transparent border-border-strong'
                  }`}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 w-full max-w-[264px]">
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                <button
                  key={d}
                  onClick={() => press(d)}
                  className="h-16 rounded-2xl bg-surface border border-border shadow-soft text-[22px] font-medium text-text-primary hover:bg-surface-2 active:scale-95 transition-all"
                >
                  {d}
                </button>
              ))}

              {config?.biometric ? (
                <button
                  onClick={() => unlockWithBiometric()}
                  aria-label="Unlock with biometrics"
                  className="h-16 rounded-2xl flex items-center justify-center text-text-muted hover:text-aura-red hover:bg-surface-2 active:scale-95 transition-all"
                >
                  <Fingerprint size={24} />
                </button>
              ) : <span />}

              <button
                onClick={() => press('0')}
                className="h-16 rounded-2xl bg-surface border border-border shadow-soft text-[22px] font-medium text-text-primary hover:bg-surface-2 active:scale-95 transition-all"
              >
                0
              </button>

              <button
                onClick={() => { haptic('tap'); setValue(v => v.slice(0, -1)); }}
                aria-label="Delete"
                className="h-16 rounded-2xl flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-2 active:scale-95 transition-all"
              >
                <Delete size={22} />
              </button>
            </div>
          </>
        )}

        {method === 'passcode' && (
          <form
            onSubmit={(e) => { e.preventDefault(); if (value) attempt(value); }}
            className="w-full flex flex-col gap-3"
          >
            <input
              ref={passcodeRef}
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
              aria-label="Passcode"
              className={`w-full h-14 px-4 rounded-2xl bg-surface border text-center text-[17px] tracking-[0.3em] text-text-primary focus:outline-none transition-colors ${
                error ? 'border-danger' : 'border-border focus:border-aura-red/60'
              }`}
            />
            <button
              type="submit"
              disabled={!value || busy}
              className="w-full h-12 rounded-2xl bg-aura-red text-on-accent font-semibold text-[15px] disabled:opacity-40 hover:brightness-110 transition-all"
            >
              Unlock
            </button>
          </form>
        )}

        {method === 'pattern' && (
          <PatternPad
            onComplete={attempt}
            resetKey={resetKey}
            disabled={busy}
            error={error}
          />
        )}

        {config?.biometric && method !== 'pin' && (
          <button
            onClick={() => unlockWithBiometric()}
            className="mt-8 flex items-center gap-2 text-[13.5px] text-text-muted hover:text-text-primary transition-colors"
          >
            <Fingerprint size={17} />
            Use biometrics
          </button>
        )}

        {attempts >= 3 && (
          <p className="mt-7 text-[12.5px] text-text-faint text-center max-w-[30ch] leading-relaxed">
            Forgot it? Clearing this site's data in your browser settings removes the lock — your chats stay in your account.
          </p>
        )}
      </motion.div>
    </div>
  );
};
