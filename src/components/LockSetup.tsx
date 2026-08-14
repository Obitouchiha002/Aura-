import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, ArrowLeft, KeyRound, Hash, Grid3x3 } from 'lucide-react';
import { useAppLock } from '../context/AppLockContext';
import { useSettings } from '../context/SettingsContext';
import { PatternPad } from './PatternPad';
import type { LockMethod } from '../utils/appLock';

/** Pick a method, enter it twice, done. */
export const LockSetup: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { enable } = useAppLock();
  const { haptic } = useSettings();

  const [method, setMethod] = useState<LockMethod | null>(null);
  const [first, setFirst] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const PIN_LENGTH = 4;

  const submit = async (secret: string) => {
    setError(null);

    if (first === null) {
      setFirst(secret);
      setValue('');
      setResetKey(k => k + 1);
      haptic('select');
      return;
    }

    if (secret !== first) {
      haptic('error');
      setError(method === 'pattern' ? 'Patterns did not match' : 'They did not match');
      setFirst(null);
      setValue('');
      setResetKey(k => k + 1);
      return;
    }

    await enable(method!, secret, 0);
    haptic('success');
    onClose();
  };

  const press = (d: string) => {
    if (value.length >= PIN_LENGTH) return;
    haptic('tap');
    const next = value + d;
    setValue(next);
    if (next.length === PIN_LENGTH) setTimeout(() => submit(next), 120);
  };

  const title = first === null ? 'Set your' : 'Confirm your';

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative bg-bg border-t sm:border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-float max-h-[92dvh] flex flex-col overflow-hidden"
      >
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-center gap-2 px-4 py-4 border-b border-border shrink-0">
          {method && (
            <button
              onClick={() => { setMethod(null); setFirst(null); setValue(''); setError(null); }}
              aria-label="Back"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-2"
            >
              <ArrowLeft size={19} />
            </button>
          )}
          <h2 className="flex-1 text-[18px] font-display font-medium tracking-[-0.01em] text-text-primary">
            {method ? `${title} ${method}` : 'App lock'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-2"
          >
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] scrollbar-hide">
          {!method && (
            <div className="space-y-2">
              <p className="text-[13.5px] text-text-muted mb-4 leading-relaxed">
                Locks this app on this device. Your code is hashed before it is
                saved, so it is never stored in readable form.
              </p>
              {([
                { id: 'pin', icon: Hash, label: 'PIN', hint: 'Four digits' },
                { id: 'passcode', icon: KeyRound, label: 'Passcode', hint: 'Letters and numbers' },
                { id: 'pattern', icon: Grid3x3, label: 'Pattern', hint: 'Connect at least four dots' },
              ] as const).map(o => (
                <button
                  key={o.id}
                  onClick={() => { haptic('select'); setMethod(o.id); }}
                  className="w-full min-h-[60px] flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-surface border border-border shadow-soft hover:border-border-strong transition-colors text-left"
                >
                  <o.icon size={19} strokeWidth={1.7} className="text-text-muted shrink-0" />
                  <span className="flex flex-col flex-1">
                    <span className="text-[15px] font-medium text-text-primary">{o.label}</span>
                    <span className="text-[12.5px] text-text-faint">{o.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {method && (
            <div className="flex flex-col items-center">
              {error && <p className="text-[13px] text-aura-red mb-4" role="alert">{error}</p>}

              {method === 'pin' && (
                <>
                  <div className="flex gap-3.5 mb-8">
                    {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                      <span key={i} className={`w-3.5 h-3.5 rounded-full border transition-colors ${
                        i < value.length ? 'bg-aura-red border-transparent' : 'bg-transparent border-border-strong'
                      }`} />
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3 w-full max-w-[264px]">
                    {['1','2','3','4','5','6','7','8','9'].map(d => (
                      <button key={d} onClick={() => press(d)}
                        className="h-16 rounded-2xl bg-surface border border-border shadow-soft text-[22px] font-medium text-text-primary hover:bg-surface-2 active:scale-95 transition-all">
                        {d}
                      </button>
                    ))}
                    <span />
                    <button onClick={() => press('0')}
                      className="h-16 rounded-2xl bg-surface border border-border shadow-soft text-[22px] font-medium text-text-primary hover:bg-surface-2 active:scale-95 transition-all">
                      0
                    </button>
                    <button onClick={() => setValue(v => v.slice(0, -1))} aria-label="Delete"
                      className="h-16 rounded-2xl flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-2 active:scale-95 transition-all">
                      ⌫
                    </button>
                  </div>
                </>
              )}

              {method === 'passcode' && (
                <form onSubmit={(e) => { e.preventDefault(); if (value.length >= 4) submit(value); }} className="w-full space-y-3">
                  <input
                    autoFocus
                    type="password"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="At least 4 characters"
                    className="w-full h-14 px-4 rounded-2xl bg-surface border border-border text-center text-[16px] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-aura-red/60 transition-colors"
                  />
                  <button type="submit" disabled={value.length < 4}
                    className="w-full h-12 rounded-2xl bg-aura-red text-on-accent font-semibold text-[15px] disabled:opacity-40 hover:brightness-110 transition-all">
                    {first === null ? 'Continue' : 'Set passcode'}
                  </button>
                </form>
              )}

              {method === 'pattern' && (
                <>
                  <p className="text-[13px] text-text-muted mb-5">Connect at least four dots</p>
                  <PatternPad onComplete={submit} resetKey={resetKey} />
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
