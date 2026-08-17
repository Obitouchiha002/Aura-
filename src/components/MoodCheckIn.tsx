import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

/**
 * A one-tap mood check before a Psychologist session.
 *
 * Stored locally only. Mood is the most sensitive thing this app touches, and
 * nothing here needs a server to be useful — the value is in seeing your own
 * pattern over a few weeks.
 */

const KEY = 'aura_mood_log';

export interface MoodEntry { at: number; level: number; note?: string }

export const MOODS = [
  { level: 1, face: '😞', en: 'Rough',     hi: 'बहुत भारी' },
  { level: 2, face: '😕', en: 'Low',       hi: 'उदास' },
  { level: 3, face: '😐', en: 'Flat',      hi: 'ठीक-ठाक' },
  { level: 4, face: '🙂', en: 'Okay',      hi: 'अच्छा' },
  { level: 5, face: '😄', en: 'Good',      hi: 'बहुत अच्छा' },
];

export function readMoodLog(): MoodEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function logMood(entry: MoodEntry) {
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...readMoodLog()].slice(0, 120)));
  } catch {}
}

/** Was there already a check-in today? */
export function checkedInToday(): boolean {
  const log = readMoodLog();
  if (!log.length) return false;
  const d = new Date(log[0].at);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

interface Props {
  lang: string;
  onClose: () => void;
  /** Logged, and the user wants to talk about it. */
  onLogged?: (entry: MoodEntry) => void;
}

export const MoodCheckIn: React.FC<Props> = ({ lang, onClose, onLogged }) => {
  const { haptic } = useSettings();
  const [chosen, setChosen] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const log = useMemo(() => readMoodLog(), [saved]);

  const recent = log.slice(0, 14).reverse();
  const average = log.length
    ? (log.slice(0, 7).reduce((s, e) => s + e.level, 0) / Math.min(log.length, 7))
    : 0;

  /**
   * `talk` decides whether the check-in also opens the conversation.
   *
   * The single button used to say "Save check-in" and then quietly drop a
   * sentence into the composer, which is not what saving means. Both things are
   * now offered by name.
   */
  const save = (talk: boolean) => {
    if (chosen === null) return;
    const entry: MoodEntry = { at: Date.now(), level: chosen, note: note.trim() || undefined };
    logMood(entry);
    haptic('success');
    setSaved(true);
    if (talk) onLogged?.(entry);
    setTimeout(onClose, 900);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative bg-bg border-t sm:border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-float max-h-[88dvh] flex flex-col overflow-hidden"
      >
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-[18px] font-display font-medium tracking-[-0.01em] text-text-primary">
            {lang === 'en' ? 'How are you, really?' : 'सच बताइए, कैसे हैं?'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-2"
          >
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] scrollbar-hide space-y-6">
          <AnimatePresence mode="wait">
            {saved ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-10 text-center"
              >
                <p className="text-[40px] mb-3">{MOODS.find(m => m.level === chosen)?.face}</p>
                <p className="text-[15px] text-text-primary font-medium">
                  {lang === 'en' ? 'Noted. Thank you.' : 'दर्ज कर लिया। शुक्रिया।'}
                </p>
              </motion.div>
            ) : (
              <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex justify-between gap-1.5">
                  {MOODS.map(m => (
                    <button
                      key={m.level}
                      onClick={() => { haptic('select'); setChosen(m.level); }}
                      aria-pressed={chosen === m.level}
                      className={`flex-1 py-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${
                        chosen === m.level
                          ? 'bg-mode-wash border-mode-tint scale-105'
                          : 'bg-surface border-border shadow-soft hover:border-border-strong'
                      }`}
                    >
                      <span className="text-[26px] leading-none">{m.face}</span>
                      <span className={`text-[10.5px] leading-tight ${chosen === m.level ? 'text-mode-tint font-medium' : 'text-text-faint'}`}>
                        {lang === 'en' ? m.en : m.hi}
                      </span>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[12px] font-medium text-text-muted mb-2 block">
                    {lang === 'en' ? 'Anything behind it? (optional)' : 'कोई वजह? (ज़रूरी नहीं)'}
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder={lang === 'en' ? 'One line is enough' : 'एक लाइन काफ़ी है'}
                    className="w-full px-4 py-3 rounded-2xl bg-surface border border-border text-[14px] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-mode-tint/50 resize-none transition-colors"
                  />
                </div>

                <div className="grid gap-2">
                  <button
                    onClick={() => save(true)}
                    disabled={chosen === null}
                    className="w-full min-h-[48px] rounded-2xl bg-aura-red text-on-accent font-semibold text-[15px] disabled:opacity-40 hover:brightness-110 transition-all"
                  >
                    {lang === 'en' ? 'Save and talk about it' : 'सेव करके बात करें'}
                  </button>
                  <button
                    onClick={() => save(false)}
                    disabled={chosen === null}
                    className="w-full min-h-[44px] rounded-2xl border border-border bg-surface text-text-body font-medium text-[14px] disabled:opacity-40 hover:bg-surface-2 transition-all"
                  >
                    {lang === 'en' ? 'Just save it' : 'सिर्फ़ सेव करें'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {recent.length > 1 && (
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[12px] font-medium text-text-muted">
                  {lang === 'en' ? 'Last 14 check-ins' : 'पिछले 14'}
                </h3>
                <span className="flex items-center gap-1.5 text-[12px] text-text-faint">
                  <TrendingUp size={13} />
                  {lang === 'en' ? '7-day avg' : '7 दिन औसत'} {average.toFixed(1)}
                </span>
              </div>

              {/* Bars, not a line chart — with this few points a line implies
                  a precision the data does not have. */}
              <div className="flex items-end gap-1 h-20">
                {recent.map((e, i) => (
                  <div
                    key={i}
                    title={`${MOODS.find(m => m.level === e.level)?.[lang === 'en' ? 'en' : 'hi']} · ${new Date(e.at).toLocaleDateString()}`}
                    className="flex-1 bg-mode-tint rounded-t-md min-h-[4px] transition-all"
                    style={{ height: `${(e.level / 5) * 100}%`, opacity: 0.35 + (i / recent.length) * 0.65 }}
                  />
                ))}
              </div>
              <p className="text-[11px] text-text-faint mt-2">
                {lang === 'en' ? 'Kept on this device only.' : 'सिर्फ़ इसी डिवाइस पर।'}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
