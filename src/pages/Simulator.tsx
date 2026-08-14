import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../context/SettingsContext';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  ArrowLeft, Brain, RefreshCcw, Trash2, Settings as SettingsIcon,
  Check, X, Clock, TrendingUp, Info,
} from 'lucide-react';
import {
  buildTest, scoreTest, DOMAIN_LABEL, TIME_LIMIT, QUESTIONS_PER_TEST,
  type TestItem, type Answer, type Report,
} from '../utils/iqTest';

/**
 * Reasoning test.
 *
 * The old version asked the model to invent an "IQ" after a few free-text
 * scenarios, so the number moved every time you asked and measured nothing.
 * This runs a fixed bank of timed multiple-choice items and scores them
 * locally — see utils/iqTest.ts.
 */

type Stage = 'START' | 'RUNNING' | 'RESULT';

interface SavedRun {
  items: TestItem[];
  answers: Answer[];
  index: number;
  startedAt: number;
}

const HISTORY_KEY = 'aura_iq_history';

interface PastResult { at: number; index: number; accuracy: number; correct: number; total: number; }

function readHistory(): PastResult[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function pushHistory(r: PastResult) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([r, ...readHistory()].slice(0, 20)));
  } catch {}
}

export default function Simulator() {
  const { lang } = useLang();
  const { haptic } = useSettings();
  const { user } = useAuth();

  const [stage, setStage] = useState<Stage>('START');
  const [run, setRun] = useState<SavedRun | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [showMissed, setShowMissed] = useState(false);
  const [history, setHistory] = useState<PastResult[]>([]);
  const [loaded, setLoaded] = useState(false);

  const questionStart = useRef<number>(Date.now());
  // The countdown fires from an interval closure, so it needs the live run
  // rather than the one captured when the interval was created.
  const runRef = useRef<SavedRun | null>(null);
  useEffect(() => { runRef.current = run; }, [run]);

  const current = run ? run.items[run.index] : null;

  useEffect(() => { setHistory(readHistory()); }, []);

  /* Resume an unfinished sitting */
  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'iqTest', 'current'));
        const d = snap.exists() ? snap.data() as any : null;
        if (Array.isArray(d?.items) && d.items.length) {
          const restored = { items: d.items, answers: d.answers || [], index: d.index || 0, startedAt: d.startedAt || Date.now() };
          runRef.current = restored;
          setRun(restored);
        }
      } catch (e) {
        console.error('Could not load the saved test', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, [user]);

  const persist = (next: SavedRun | null) => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid, 'iqTest', 'current');
    if (next) setDoc(ref, next as any).catch(console.error);
    else deleteDoc(ref).catch(console.error);
  };

  /**
   * Records one answer and moves on.
   *
   * Everything here runs outside the state updater on purpose: an updater must
   * be pure, and React's StrictMode double-invokes it. With the side effects
   * inside, one finished test wrote two history entries.
   */
  const submit = (choice: number | null) => {
    const prev = runRef.current;
    if (!prev) return;
    const item = prev.items[prev.index];
    if (!item) return;

    const answer: Answer = {
      itemId: item.id,
      chosen: choice,
      correct: choice !== null && choice === item.correctIndex,
      seconds: Math.max(1, Math.round((Date.now() - questionStart.current) / 1000)),
    };
    haptic(answer.correct ? 'success' : 'tap');

    const answers = [...prev.answers, answer];
    const nextIndex = prev.index + 1;
    const done = nextIndex >= prev.items.length;
    const next: SavedRun = { ...prev, answers, index: done ? prev.index : nextIndex };

    runRef.current = next;
    setRun(next);
    setPicked(null);

    if (done) {
      const r = scoreTest(prev.items, answers);
      setReport(r);
      setStage('RESULT');
      pushHistory({ at: Date.now(), index: r.index, accuracy: r.accuracy, correct: r.correct, total: r.total });
      setHistory(readHistory());
      persist(null);
    } else {
      persist(next);
    }
  };

  /* Per-question countdown */
  useEffect(() => {
    if (stage !== 'RUNNING' || !current) return;
    setSecondsLeft(TIME_LIMIT[current.difficulty]);
    questionStart.current = Date.now();

    const t = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(t);
          submit(null);            // out of time counts as unanswered
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [stage, run?.index, current?.id]);

  const startFresh = () => {
    haptic('impact');
    const next: SavedRun = { items: buildTest(), answers: [], index: 0, startedAt: Date.now() };
    runRef.current = next;
    setRun(next);
    setReport(null);
    setPicked(null);
    setShowMissed(false);
    setStage('RUNNING');
    persist(next);
  };

  const resume = () => {
    haptic('impact');
    setPicked(null);
    setStage('RUNNING');
  };

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    // A beat so the choice registers before the next question slides in.
    setTimeout(() => submit(i), 260);
  };

  const discard = () => {
    haptic('select');
    runRef.current = null;
    setRun(null);
    setReport(null);
    setStage('START');
    persist(null);
  };

  const best = useMemo(() => history.reduce((m, h) => Math.max(m, h.index), 0), [history]);

  const progress = run ? (run.index / run.items.length) * 100 : 0;
  const timeLimit = current ? TIME_LIMIT[current.difficulty] : 1;
  const timeFrac = current ? secondsLeft / timeLimit : 1;
  const hasUnfinished = !!(loaded && run && run.index > 0 && run.index < run.items.length);

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-bg app-container">
      <div className="w-full flex justify-between items-center max-w-3xl mx-auto px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] relative z-20 border-b border-border">
        <button
          onClick={() => { haptic('select'); window.location.hash = 'chat'; }}
          className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors rounded-xl hover:bg-surface-2 bg-surface border border-border shadow-soft"
          title={lang === 'en' ? 'Back to chat' : 'चैट पर वापस'}
        >
          <ArrowLeft size={18} />
        </button>

        <span className="px-4 py-2 rounded-full text-[12px] tracking-[0.06em] bg-aura-red text-on-accent font-semibold whitespace-nowrap">
          {lang === 'en' ? 'Reasoning Test' : 'तर्क परीक्षा'}
        </span>

        <div className="flex items-center gap-1">
          {(run || report) && (
            <button
              onClick={discard}
              className="w-10 h-10 flex items-center justify-center text-text-faint hover:text-aura-red transition-colors rounded-xl hover:bg-accent-wash"
              title={lang === 'en' ? 'Discard' : 'हटाएं'}
            >
              <Trash2 size={17} />
            </button>
          )}
          <button
            onClick={() => { haptic('select'); window.location.hash = 'settings'; }}
            className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors rounded-xl hover:bg-surface-2 bg-surface border border-border shadow-soft"
          >
            <SettingsIcon size={17} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative z-10 scrollbar-hide flex flex-col">
        <AnimatePresence mode="wait">

          {stage === 'START' && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center gap-6 p-6 max-w-md mx-auto w-full"
            >
              <span className="w-16 h-16 rounded-2xl bg-surface border border-border shadow-soft flex items-center justify-center">
                <Brain size={28} className="text-aura-red" strokeWidth={1.6} />
              </span>

              <div className="space-y-2">
                <h2 className="text-[26px] font-display font-medium tracking-[-0.015em] text-text-primary">
                  {lang === 'en' ? 'Reasoning Test' : 'तर्क परीक्षा'}
                </h2>
                <p className="text-[14px] text-text-muted leading-relaxed max-w-[34ch] mx-auto">
                  {lang === 'en'
                    ? `${QUESTIONS_PER_TEST} questions across five kinds of thinking. Timed. Scored the same way every time.`
                    : `पाँच तरह की सोच पर ${QUESTIONS_PER_TEST} सवाल। समय सीमित। हर बार एक ही तरीके से जाँच।`}
                </p>
              </div>

              {history.length > 0 && (
                <div className="w-full flex gap-2">
                  {[
                    { label: lang === 'en' ? 'Last' : 'पिछला', value: history[0].index },
                    { label: lang === 'en' ? 'Best' : 'सर्वश्रेष्ठ', value: best },
                    { label: lang === 'en' ? 'Taken' : 'बार', value: history.length },
                  ].map(s => (
                    <div key={s.label} className="flex-1 p-3 rounded-2xl bg-surface border border-border shadow-soft">
                      <p className="text-[11.5px] text-text-faint">{s.label}</p>
                      <p className="text-[19px] font-semibold text-text-primary">{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="w-full space-y-2.5">
                {hasUnfinished && (
                  <button
                    onClick={resume}
                    className="w-full min-h-[52px] rounded-2xl bg-aura-red text-on-accent font-semibold text-[15px] hover:brightness-110 transition-all"
                  >
                    {lang === 'en'
                      ? `Resume — question ${run!.index + 1} of ${run!.items.length}`
                      : `जारी रखें — सवाल ${run!.index + 1}/${run!.items.length}`}
                  </button>
                )}
                <button
                  onClick={startFresh}
                  className={`w-full min-h-[52px] rounded-2xl font-semibold text-[15px] transition-all ${
                    hasUnfinished
                      ? 'bg-surface border border-border shadow-soft text-text-primary hover:bg-surface-2'
                      : 'bg-aura-red text-on-accent hover:brightness-110'
                  }`}
                >
                  {lang === 'en' ? 'Start a new test' : 'नई परीक्षा शुरू करें'}
                </button>
              </div>

              <p className="flex items-start gap-2 text-[12px] text-text-faint leading-relaxed text-left">
                <Info size={14} className="shrink-0 mt-0.5" />
                {lang === 'en'
                  ? 'A self-administered reasoning test, not a clinical IQ assessment. Read the number as a snapshot of these questions.'
                  : 'यह स्वयं दी जाने वाली तर्क परीक्षा है, क्लीनिकल IQ जाँच नहीं। अंक को इन्हीं सवालों का नतीजा समझिए।'}
              </p>
            </motion.div>
          )}

          {stage === 'RUNNING' && current && (
            <motion.div
              key={`q-${run!.index}`}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col p-4 md:p-6 max-w-3xl mx-auto w-full"
            >
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2.5 gap-3">
                  <span className="text-[12px] font-medium text-text-muted truncate">
                    {lang === 'en'
                      ? `Question ${run!.index + 1} of ${run!.items.length}`
                      : `सवाल ${run!.index + 1}/${run!.items.length}`}
                    <span className="text-text-faint"> · {DOMAIN_LABEL[current.domain]}</span>
                  </span>
                  <span className={`flex items-center gap-1.5 text-[12px] font-mono tabular-nums shrink-0 ${
                    timeFrac < 0.25 ? 'text-aura-red' : 'text-text-muted'
                  }`}>
                    <Clock size={13} />
                    0:{String(secondsLeft).padStart(2, '0')}
                  </span>
                </div>

                <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full bg-aura-red rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <div className="h-[3px] mt-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-linear ${timeFrac < 0.25 ? 'bg-aura-red' : 'bg-border-strong'}`}
                    style={{ width: `${timeFrac * 100}%` }}
                  />
                </div>
              </div>

              {/* Centred in whatever space is left below the progress bar.
                  Sitting flush to the top left the lower half of a desktop
                  screen empty, which made a four-option question look lost. */}
              <div className="flex-1 flex flex-col justify-center pb-6 min-h-0">
              <p className="text-[19px] sm:text-[22px] text-text-primary leading-[1.45] mb-7">
                {current.question}
              </p>

              <div className="grid gap-2.5">
                {current.shuffled.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => choose(i)}
                    disabled={picked !== null}
                    className={`min-h-[56px] text-left px-4 py-3 rounded-2xl border flex items-center gap-3.5 transition-all ${
                      picked === i
                        ? 'bg-accent-wash border-aura-red text-text-primary'
                        : 'bg-surface border-border hover:border-border-strong shadow-soft text-text-body'
                    } ${picked !== null && picked !== i ? 'opacity-50' : ''}`}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 border ${
                      picked === i ? 'bg-aura-red text-on-accent border-transparent' : 'bg-surface-2 text-text-muted border-border'
                    }`}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-[15.5px] leading-snug">{opt}</span>
                  </button>
                ))}
              </div>
              </div>
            </motion.div>
          )}

          {stage === 'RESULT' && report && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col p-4 md:p-6 max-w-3xl mx-auto w-full gap-6"
            >
              <div className="flex flex-col items-center text-center p-6 rounded-3xl bg-surface border border-border shadow-pop">
                <p className="text-[12px] font-medium text-text-muted mb-1">
                  {lang === 'en' ? 'Reasoning Index' : 'तर्क सूचकांक'}
                </p>
                <p className="text-[56px] leading-none font-display font-semibold text-aura-red mb-1.5">{report.index}</p>
                <p className="text-[14px] text-text-primary font-medium">{report.band}</p>
                <p className="text-[12.5px] text-text-faint mt-2">
                  {report.correct}/{report.total} {lang === 'en' ? 'correct' : 'सही'} · {report.accuracy}%
                  {' · '}{lang === 'en' ? 'median' : 'औसत'} {report.medianSeconds}s
                </p>

                {history.length > 1 && (
                  <p className="flex items-center gap-1.5 text-[12.5px] text-text-muted mt-3">
                    <TrendingUp size={14} />
                    {(() => {
                      const diff = report.index - history[1].index;
                      if (diff === 0) return lang === 'en' ? 'Same as last time' : 'पिछली बार जैसा';
                      return lang === 'en'
                        ? `${diff > 0 ? '+' : ''}${diff} vs last time`
                        : `पिछली बार से ${diff > 0 ? '+' : ''}${diff}`;
                    })()}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-[13px] font-medium text-text-muted mb-3">
                  {lang === 'en' ? 'By type of thinking' : 'सोच के प्रकार से'}
                </h3>
                <div className="space-y-3">
                  {report.domains.map(d => (
                    <div key={d.domain}>
                      <div className="flex justify-between text-[13px] mb-1.5">
                        <span className="text-text-body">{DOMAIN_LABEL[d.domain]}</span>
                        <span className="text-text-faint font-mono tabular-nums">{d.correct}/{d.total}</span>
                      </div>
                      <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full bg-aura-red rounded-full transition-all duration-700" style={{ width: `${d.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {report.strongest && report.weakest && report.strongest !== report.weakest && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3.5 rounded-2xl bg-surface border border-border shadow-soft">
                    <p className="text-[11.5px] text-text-faint mb-1">{lang === 'en' ? 'Strongest' : 'सबसे मज़बूत'}</p>
                    <p className="text-[14px] text-text-primary font-medium">{DOMAIN_LABEL[report.strongest]}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-surface border border-border shadow-soft">
                    <p className="text-[11.5px] text-text-faint mb-1">{lang === 'en' ? 'Weakest' : 'सबसे कमज़ोर'}</p>
                    <p className="text-[14px] text-text-primary font-medium">{DOMAIN_LABEL[report.weakest]}</p>
                  </div>
                </div>
              )}

              {report.missed.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowMissed(v => !v)}
                    className="w-full min-h-[48px] px-4 rounded-2xl bg-surface border border-border shadow-soft text-[14px] font-medium text-text-primary hover:bg-surface-2 transition-colors flex items-center justify-between"
                  >
                    {lang === 'en' ? `Review ${report.missed.length} missed` : `${report.missed.length} गलत देखें`}
                    <span className="text-text-faint text-[15px]">{showMissed ? '−' : '+'}</span>
                  </button>

                  <AnimatePresence>
                    {showMissed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 pt-3">
                          {report.missed.map(({ item, chosen }) => (
                            <div key={item.id} className="p-4 rounded-2xl bg-surface border border-border">
                              <p className="text-[10.5px] text-text-faint mb-2">{DOMAIN_LABEL[item.domain]}</p>
                              <p className="text-[14px] text-text-primary mb-3 leading-snug">{item.question}</p>
                              <p className="flex items-start gap-2 text-[13px] text-danger mb-1.5">
                                <X size={14} className="shrink-0 mt-0.5" />
                                {chosen ?? (lang === 'en' ? 'No answer — ran out of time' : 'जवाब नहीं — समय खत्म')}
                              </p>
                              <p className="flex items-start gap-2 text-[13px] text-success mb-2.5">
                                <Check size={14} className="shrink-0 mt-0.5" />
                                {item.options[item.answer]}
                              </p>
                              <p className="text-[12.5px] text-text-muted leading-relaxed pl-[22px]">{item.explanation}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <button
                onClick={startFresh}
                className="w-full min-h-[52px] rounded-2xl bg-aura-red text-on-accent font-semibold text-[15px] hover:brightness-110 transition-all flex items-center justify-center gap-2 mt-1"
              >
                <RefreshCcw size={16} />
                {lang === 'en' ? 'Take it again — new questions' : 'फिर से — नए सवाल'}
              </button>

              <p className="flex items-start gap-2 text-[12px] text-text-faint leading-relaxed pb-4">
                <Info size={14} className="shrink-0 mt-0.5" />
                {lang === 'en'
                  ? 'Scored from your actual answers, weighted by question difficulty. Not a clinical IQ assessment.'
                  : 'आपके जवाबों से, सवाल की कठिनाई के हिसाब से निकाला गया। यह क्लीनिकल IQ जाँच नहीं है।'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
