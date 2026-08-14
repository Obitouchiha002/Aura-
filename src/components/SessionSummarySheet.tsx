import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Check, Copy, RefreshCcw, ArrowRight } from 'lucide-react';
import { getSessionSummary, type SessionSummary } from '../services/geminiService';
import { useSettings } from '../context/SettingsContext';

interface Props {
  messages: { text: string; isAi: boolean; character?: string }[];
  mode: string;
  lang: string;
  onClose: () => void;
}

export const SessionSummarySheet: React.FC<Props> = ({ messages, mode, lang, onClose }) => {
  const { userApiKey, language, haptic } = useSettings();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setError(null);
    setSummary(null);
    try {
      const s = await getSessionSummary(messages, mode, userApiKey, language);
      setSummary(s);
      haptic('success');
    } catch (e: any) {
      haptic('error');
      setError(e?.message || 'Could not summarise this session.');
    }
  };

  useEffect(() => {
    run();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const copyAll = async () => {
    if (!summary) return;
    const text = [
      summary.title,
      '',
      ...summary.covered.map(c => `• ${c}`),
      '',
      `Takeaway: ${summary.takeaway}`,
      `Next: ${summary.nextStep}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      haptic('success');
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
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
            {lang === 'en' ? 'Session summary' : 'सत्र का सार'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-2"
          >
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] scrollbar-hide">
          {!summary && !error && (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-mode-tint rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-mode-tint rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-mode-tint rounded-full animate-bounce" />
              </div>
              <p className="text-[13px] text-text-muted">
                {lang === 'en' ? 'Reading back through the session…' : 'सत्र दोबारा पढ़ा जा रहा है…'}
              </p>
            </div>
          )}

          {error && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <p className="text-[13.5px] text-text-muted max-w-[32ch] leading-relaxed">{error}</p>
              <button
                onClick={run}
                className="min-h-[44px] px-5 rounded-xl bg-aura-red text-on-accent text-[14px] font-semibold hover:brightness-110 transition-all flex items-center gap-2"
              >
                <RefreshCcw size={15} />
                {lang === 'en' ? 'Try again' : 'दोबारा'}
              </button>
            </div>
          )}

          {summary && (
            <div className="space-y-6">
              <h3 className="text-[20px] font-display font-medium text-text-primary tracking-[-0.01em]">
                {summary.title}
              </h3>

              {summary.covered.length > 0 && (
                <div>
                  <p className="text-[12px] font-medium text-text-muted mb-2.5">
                    {lang === 'en' ? 'What we covered' : 'क्या बात हुई'}
                  </p>
                  <ul className="space-y-2">
                    {summary.covered.map((c, i) => (
                      <li key={i} className="flex gap-2.5 text-[14px] text-text-body leading-relaxed">
                        <span className="text-mode-tint mt-[3px] shrink-0">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.takeaway && (
                <div className="p-4 rounded-2xl bg-mode-wash border border-mode-tint/25">
                  <p className="text-[12px] font-medium text-mode-tint mb-1.5">
                    {lang === 'en' ? 'Takeaway' : 'मुख्य बात'}
                  </p>
                  <p className="text-[14.5px] text-text-primary leading-relaxed">{summary.takeaway}</p>
                </div>
              )}

              {summary.nextStep && (
                <div className="flex gap-3 p-4 rounded-2xl bg-surface border border-border shadow-soft">
                  <ArrowRight size={17} className="text-text-muted shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] font-medium text-text-muted mb-1">
                      {lang === 'en' ? 'Next' : 'आगे'}
                    </p>
                    <p className="text-[14px] text-text-body leading-relaxed">{summary.nextStep}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={copyAll}
                  className="flex-1 min-h-[44px] rounded-xl bg-surface border border-border shadow-soft text-text-primary text-[14px] font-medium hover:bg-surface-2 transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied
                    ? (lang === 'en' ? 'Copied' : 'कॉपी हुआ')
                    : (lang === 'en' ? 'Copy' : 'कॉपी')}
                </button>
                <button
                  onClick={run}
                  aria-label={lang === 'en' ? 'Regenerate' : 'दोबारा बनाएं'}
                  className="w-12 min-h-[44px] rounded-xl bg-surface border border-border shadow-soft text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors flex items-center justify-center"
                >
                  <RefreshCcw size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
