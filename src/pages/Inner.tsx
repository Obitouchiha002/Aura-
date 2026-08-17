import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getInnerVoiceResponse, getInnerVoiceImageResponse, type Attachment } from '../services/geminiService';
import { generateImage } from '../services/nvidiaService';
import { useSettings } from '../context/SettingsContext';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Send, Trash2, ChevronDown, History, X, MessageSquare, Plus, Settings as SettingsIcon, RefreshCcw, Download, Users, Sparkles, Target, Gamepad2, Mic, Ghost, Copy, Check, Search, Menu, Eye, Paperclip, Camera, ImagePlus, FileText, FileDown, Printer, ClipboardList, HeartPulse, GraduationCap } from 'lucide-react';
import { Settings } from '../components/Settings';
import Focus from './Focus';
import Simulator from './Simulator';

const CHARACTERS: Record<'MENTOR' | 'EMOTION', string[]> = {
  MENTOR: [
    "Thomas Shelby", "Tywin Lannister", "Petyr Baelish", "Cersei Lannister", "Tyrion Lannister",
    "Madara Uchiha", "Itachi Uchiha", "Pain", "Shikamaru Nara", "Johan Liebert", "Kiyotaka Ayanokoji",
    "L (Death Note)", "Sosuke Aizen (Bleach)", "Senku Ishigami (Dr. Stone)", "Chanakya (चाणक्य)",
    "Sun Tzu (The Art of War)", "Niccolò Machiavelli", "Harvey Specter (Suits)", "Gustavo Fring (Breaking Bad)"
  ],
  EMOTION: [
    "Mirza Ghalib", "Jaun Elia", "Faiz Ahmed Faiz", "Ahmad Faraz", "Gulzar", "William Shakespeare"
  ]
};

type Mode = 'COUNCIL' | 'MENTOR' | 'EMOTION' | 'TEACHER' | 'PSYCHOLOGY';

interface ChatSession {
  id: string;
  title: string;
  /** The room it is in now. */
  mode: Mode;
  character: string;
  updatedAt: number;
  messages?: any[];
  /**
   * Every room this thread has passed through, in order.
   *
   * A conversation is about a subject, not about a room — you can take the
   * same problem to the Council and then to the Psychologist. Recording the
   * trail is what stops a handoff erasing where the thread began.
   */
  rooms?: Mode[];
}

/** A message, or the marker left behind when the thread changed rooms. */
interface Handoff {
  from: Mode;
  to: Mode;
  /** Who was being spoken to, when the room was Mentor. */
  character?: string;
}

/**
 * Openers for the empty state, per room.
 *
 * Written as the thing a person would actually type, not as feature names —
 * "Should I take this job?" gets someone further than "Ask advice".
 */
const STARTERS: Record<Mode, [string, string][]> = {
  COUNCIL: [
    ['Should I take this job?', 'ये job लूँ या नहीं?'],
    ['Tell me what I am avoiding', 'बताइए मैं किस बात से बच रहा हूँ'],
    ['Argue against my plan', 'मेरे plan के खिलाफ़ बोलिए'],
  ],
  MENTOR: [
    ['What would you do here?', 'आप होते तो क्या करते?'],
    ['I keep second-guessing myself', 'मैं बार-बार खुद पर शक करता हूँ'],
    ['How do I ask for more?', 'ज़्यादा कैसे माँगूँ?'],
  ],
  PSYCHOLOGY: [
    ['I have not been sleeping', 'नींद नहीं आ रही'],
    ['Everything feels like too much', 'सब कुछ भारी लग रहा है'],
    ['I keep saying yes to things', 'मैं हर बात के लिए हाँ कह देता हूँ'],
  ],
  TEACHER: [
    ['Explain this to me simply', 'इसे आसान भाषा में समझाइए'],
    ['Quiz me on something', 'मुझसे कुछ सवाल पूछिए'],
    ['Make notes on a topic', 'एक विषय पर नोट्स बनाइए'],
  ],
  EMOTION: [
    ['I miss someone', 'किसी की याद आ रही है'],
    ['Nothing feels like anything', 'कुछ भी महसूस नहीं हो रहा'],
    ['Write me something for tonight', 'आज रात के लिए कुछ लिखिए'],
  ],
};

const ROOM_NAME: Record<Mode, string> = {
  COUNCIL: 'The Council',
  MENTOR: 'The Mentor',
  PSYCHOLOGY: 'The Psychologist',
  TEACHER: 'The Teacher',
  EMOTION: 'The Poets',
};

function HistoryDrawerComponent({ onClose, sessions, loadSession, currentSessionId, deleteSession, lang }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'COUNCIL' | 'MENTOR' | 'PSYCHOLOGY' | 'TEACHER' | 'EMOTION'>('ALL');

  // Escape closes the drawer, matching every other overlay in the app
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Newest first, whatever room it happened in. Sorting here rather than where
  // the array is written means the order holds however a session got updated.
  const filteredSessions = sessions
    .filter((s: any) => {
      const q = searchQuery.toLowerCase();
      const matchesQuery = !q
        || s.title?.toLowerCase().includes(q)
        || s.character?.toLowerCase().includes(q);
      const matchesFilter = selectedFilter === 'ALL' || s.mode === selectedFilter;
      return matchesQuery && matchesFilter;
    })
    .sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const MODE_LABEL: Record<string, string> = {
    COUNCIL: 'Council', MENTOR: 'Mentor', PSYCHOLOGY: 'Psychologist',
    TEACHER: 'Teacher', EMOTION: 'Poets',
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-scrim backdrop-blur-sm"
      />
      {/* Full-screen sheet on phones — at 320px wide the filter pills were
          clipped and the rows had no room. Side drawer on desktop. */}
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
        className="absolute inset-0 sm:inset-y-0 sm:left-0 sm:right-auto sm:w-96 bg-bg sm:border-r sm:border-border flex flex-col shadow-float"
      >
        <div className="px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between gap-3 shrink-0">
          <h2 className="text-[17px] font-display font-medium tracking-[-0.01em] text-text-primary">
            {lang === 'en' ? 'Chat history' : 'चैट हिस्ट्री'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-text-primary rounded-xl hover:bg-surface-2 transition-colors"
          >
            <X size={19} />
          </button>
        </div>

        {/* Sticky so search and filters stay reachable while the list scrolls */}
        <div className="px-4 pb-3 space-y-2.5 shrink-0 bg-bg border-b border-border">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none" />
            <input
              type="text"
              placeholder={lang === 'en' ? 'Search chats' : 'चैट खोजें'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl py-2.5 pl-9 pr-9 text-[13.5px] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-aura-red/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-text-faint hover:text-text-primary hover:bg-surface-2"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Fade on the right edge signals there is more to scroll to */}
            {/* One scrollable row at every width. It used to switch to a plain
                flex row above sm:, which had no overflow handling — so Teacher
                and Poets were clipped against the fade instead of reachable. */}
            <div className="relative -mx-1">
            <div className="flex items-center gap-1.5 px-1 py-0.5 overflow-x-auto scrollbar-hide snap-x">
              {[
                { id: 'ALL', label: lang === 'en' ? 'All' : 'सभी' },
                { id: 'COUNCIL', label: lang === 'en' ? 'Council' : 'परिषद' },
                { id: 'MENTOR', label: lang === 'en' ? 'Mentor' : 'गुरु' },
                { id: 'PSYCHOLOGY', label: lang === 'en' ? 'Psychologist' : 'मनोविज्ञान' },
                { id: 'TEACHER', label: lang === 'en' ? 'Teacher' : 'शिक्षक' },
                { id: 'EMOTION', label: lang === 'en' ? 'Poets' : 'कवि' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFilter(f.id as any)}
                  aria-pressed={selectedFilter === f.id}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors shrink-0 snap-start border ${
                    selectedFilter === f.id
                      ? 'bg-aura-red text-on-accent border-transparent'
                      : 'bg-surface text-text-muted hover:text-text-primary border-border'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-6 scrollbar-hide">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-6 py-16">
              <span className="w-14 h-14 rounded-2xl bg-surface border border-border shadow-soft flex items-center justify-center mb-4">
                {sessions.length === 0
                  ? <MessageSquare size={22} className="text-text-faint" strokeWidth={1.6} />
                  : <Search size={22} className="text-text-faint" strokeWidth={1.6} />}
              </span>
              <p className="text-[15px] font-medium text-text-primary">
                {sessions.length === 0
                  ? (lang === 'en' ? 'No chats yet' : 'अभी कोई चैट नहीं')
                  : (lang === 'en' ? 'No matches' : 'कुछ नहीं मिला')}
              </p>
              <p className="text-[13px] text-text-muted mt-1.5 max-w-[30ch] leading-relaxed">
                {sessions.length === 0
                  ? (lang === 'en' ? 'Start a conversation and it will show up here.' : 'बातचीत शुरू कीजिए, यहाँ दिखने लगेगी।')
                  : (lang === 'en' ? 'Try a different name or search term.' : 'कोई और नाम या शब्द आज़माइए।')}
              </p>
              {sessions.length === 0 && (
                <button
                  onClick={onClose}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-aura-red text-on-accent text-[13px] font-semibold hover:brightness-110 transition-all"
                >
                  {lang === 'en' ? 'Start a conversation' : 'बातचीत शुरू करें'}
                </button>
              )}
            </div>
          ) : (
            (
              <div className="space-y-1.5">
                  {filteredSessions.map((session: any) => (
                    <div
                      key={session.id}
                      data-mode={session.mode}
                      role="button"
                      tabIndex={0}
                      onClick={() => loadSession(session)}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          loadSession(session);
                        }
                      }}
                      className={`w-full text-left p-3 pr-12 rounded-2xl border transition-all group cursor-pointer relative ${
                        currentSessionId === session.id
                          ? 'bg-mode-wash border-mode-tint/40'
                          : 'bg-surface border-border hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-[14px] font-medium truncate ${
                          currentSessionId === session.id ? 'text-mode-tint' : 'text-text-primary'
                        }`}>
                          {displayName(session.character || '').name}
                        </span>
                        <span className="text-[11.5px] text-text-faint shrink-0 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-mode-tint" aria-hidden />
                          {MODE_LABEL[session.mode] || ''} &middot; {new Date(session.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-text-muted truncate">{session.title}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        title={lang === 'en' ? 'Delete chat' : 'चैट हटाएं'}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-xl text-text-faint hover:text-aura-red hover:bg-accent-wash md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
              </div>
            )
          )}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * One mark for every room in the app: an eye that blinks, with a slowly
 * turning iris. Incognito wears the three-tomoe sharingan; each mode wears its
 * own mangekyou pattern in its own tint, so the screens read as a family.
 */
function EyeMark({ pattern, tint, size = 60 }: {
  pattern: 'tomoe' | { blades: number; twist: number };
  tint: string;
  size?: number;
}) {
  return (
    <span
      className="rounded-2xl bg-surface border border-border shadow-soft flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 48 48" width={size * 0.66} height={size * 0.66} className="eye-blink">
        {/* eye almond */}
        <path
          d="M24 11.5c9.2 0 16.9 6.8 20.5 12.5C40.9 29.7 33.2 36.5 24 36.5S7.1 29.7 3.5 24C7.1 18.3 14.8 11.5 24 11.5Z"
          fill="var(--surface-2)"
          stroke="var(--border-strong)"
          strokeWidth="1.3"
        />
        <circle cx="24" cy="24" r="9.2" fill={tint} />

        <g className="eye-turn" style={{ transformOrigin: '24px 24px' }}>
          {pattern === 'tomoe'
            ? [0, 120, 240].map(deg => (
                <g key={deg} transform={`rotate(${deg} 24 24)`}>
                  <circle cx="24" cy="17.6" r="1.9" fill="var(--bg)" />
                  <path d="M24.2 15.8c-2.7-.2-4.8 1.3-5.6 3.3 1.4-1.2 3.4-1.7 5.4-1.6Z" fill="var(--bg)" />
                </g>
              ))
            : Array.from({ length: pattern.blades }).map((_, i) => (
                <path
                  key={i}
                  /* One tapered blade from the pupil out to the iris rim,
                     repeated around the circle — the mangekyou pinwheel. */
                  d="M24 24.6C26.2 21 26.7 18 24 15.4 21.3 18 21.8 21 24 24.6Z"
                  fill="var(--bg)"
                  transform={`rotate(${(360 / pattern.blades) * i + pattern.twist} 24 24)`}
                />
              ))}
        </g>

        <circle cx="24" cy="24" r="3" fill="var(--bg)" />
        <circle cx="24" cy="24" r="9.2" fill="none" stroke={tint} strokeWidth="1.2" opacity="0.55" />
      </svg>
    </span>
  );
}

/** Each mode's iris pattern. Council gets five blades for five minds. */
const MODE_EYE: Record<Mode, { blades: number; twist: number }> = {
  COUNCIL: { blades: 5, twist: 0 },
  MENTOR: { blades: 3, twist: 10 },
  PSYCHOLOGY: { blades: 6, twist: 0 },
  TEACHER: { blades: 4, twist: 45 },
  EMOTION: { blades: 8, twist: 22 },
};

/* The stored character string is what gets sent to the model and written to
   Firestore, so it must never change. These two helpers only affect display:
   "Sosuke Aizen (Bleach)" shows as a name with its source underneath. */
function displayName(value: string): { name: string; source?: string } {
  const m = value.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { name: m[1].trim(), source: m[2].trim() } : { name: value };
}

/** Every character the app knows, for resolving a shortened name. */
const ALL_CHARACTERS = [...CHARACTERS.MENTOR, ...CHARACTERS.EMOTION];

/**
 * Turns whatever the model wrote into the character it meant.
 *
 * Replies are signed loosely — "Shelby", "Ayanokoji", "Ghalib" — while the
 * portraits and the roster are keyed to full names. Without this the label
 * reads SHELBY over a pair of initials while the photograph of Thomas Shelby
 * sits unused.
 *
 * A surname shared by several characters resolves to nothing rather than to a
 * guess: showing Tywin's face above Tyrion's words would be worse than showing
 * no face at all.
 */
function resolveCharacter(raw: string): string | null {
  const norm = (v: string) => v.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase().trim();
  const target = norm(raw);
  if (!target) return null;

  const exact = ALL_CHARACTERS.find(c => norm(c) === target);
  if (exact) return exact;

  // A single word: match it against any word of a full name.
  const hits = ALL_CHARACTERS.filter(c => norm(c).split(/\s+/).includes(target));
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Who is speaking in a reply.
 *
 * Council and Poets answer as one voice out of several, and the name arrives
 * inside the text as "[Thomas Shelby] …" rather than on the message. That
 * bracketed name is the only place it exists, so it is read from there; Mentor
 * carries it on the message already.
 */
function speakerOf(text: string, character?: string): string | null {
  const m = text.match(/^\s*\[([^\]]{2,40})\]/);
  if (m) {
    const name = m[1].replace(/\s+Response$/i, '').trim();
    if (name && !/^system/i.test(name)) return resolveCharacter(name) || name;
  }
  // A room's own name is not a person and has no face.
  if (character && !/^The (Council|Poets|Teacher|Psychologist)$/i.test(character)) {
    return character;
  }
  return null;
}

/**
 * Drops the "[Name] Response" the model opens with.
 *
 * Only for display, and only once that name is already on the label above —
 * the stored text keeps it, so history and exports still say who spoke.
 */
function withoutSpeakerPrefix(text: string): string {
  return text.replace(/^\s*\[[^\]]{2,40}\]\s*(Response\s*:?)?\s*/i, '');
}

function initials(value: string): string {
  const words = displayName(value).name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Everything that used to crowd the mobile top bar, in one sheet. */
function AppMenu({ lang, onClose, items }: {
  lang: string;
  onClose: () => void;
  items: { icon: React.ComponentType<any>; label: string; hint?: string; onClick: () => void; danger?: boolean; active?: boolean; disabled?: boolean }[];
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[90] bg-scrim backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        role="menu"
        className="fixed z-[95] inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:top-16 sm:right-6 sm:w-72 bg-elevated border border-border rounded-t-3xl sm:rounded-2xl shadow-float p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-2"
      >
        <div className="sm:hidden pt-1 pb-3 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-border-strong" />
        </div>
        {items.map(item => (
          <button
            key={item.label}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => { item.onClick(); onClose(); }}
            /* 40% opacity read as a rendering fault rather than a state. These
               sit at a legible weight now and carry a reason instead. */
            className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-left transition-colors disabled:opacity-70 disabled:pointer-events-none ${
              item.danger
                ? 'text-aura-red hover:bg-accent-wash'
                : item.active
                ? 'bg-accent-wash text-aura-red'
                : 'text-text-body hover:bg-surface-2 hover:text-text-primary'
            }`}
          >
            <item.icon size={18} strokeWidth={1.6} className="shrink-0" />
            <span className="flex flex-col min-w-0 flex-1">
              <span className="text-[14.5px] font-medium leading-tight flex items-center gap-2">
                {item.label}
                {item.disabled && (
                  <span className="text-[10.5px] font-normal text-text-faint border border-border rounded-full px-1.5 py-0.5 whitespace-nowrap">
                    {lang === 'en' ? 'after a chat' : 'चैट के बाद'}
                  </span>
                )}
              </span>
              {item.hint && <span className="text-[12px] text-text-faint leading-tight mt-0.5">{item.hint}</span>}
            </span>
            {item.active && <Check size={15} className="shrink-0" />}
          </button>
        ))}
      </motion.div>
    </>
  );
}

function CharacterPicker({ mode, lang, options, selected, onSelect, onClose }: {
  mode: 'MENTOR' | 'EMOTION';
  lang: string;
  options: string[];
  selected: string;
  onSelect: (char: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = options.filter(c => c.toLowerCase().includes(q.trim().toLowerCase()));
  const showSearch = options.length > 8;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-scrim backdrop-blur-sm"
      />
      {/* Bottom sheet on phones, centred dialog on desktop. It is no longer
          anchored under its trigger — the trigger now lives in the header. */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="fixed z-50 inset-x-0 bottom-0 md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[620px] bg-elevated border border-border rounded-t-3xl md:rounded-3xl shadow-float flex flex-col max-h-[80dvh] md:max-h-[70vh] overflow-hidden"
      >
        <div className="md:hidden pt-3 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary">
              {lang === 'en'
                ? (mode === 'MENTOR' ? 'Choose a mentor' : 'Choose a poet')
                : (mode === 'MENTOR' ? 'गुरु चुनिए' : 'कवि चुनिए')}
            </h3>
            <p className="text-[11px] text-text-faint mt-0.5">
              {filtered.length} {lang === 'en' ? 'available' : 'उपलब्ध'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full text-text-faint hover:text-text-primary hover:bg-surface-2 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {showSearch && (
          <div className="px-5 pb-3 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={lang === 'en' ? 'Search by name…' : 'नाम से खोजें…'}
                className="w-full bg-surface border border-border rounded-xl py-2.5 pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-aura-red/50 transition-colors"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-5 scrollbar-hide">
          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-text-faint py-10">
              {lang === 'en' ? 'No one by that name.' : 'इस नाम का कोई नहीं मिला।'}
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-1.5">
              {filtered.map(char => {
                const { name, source } = displayName(char);
                const isActive = selected === char;
                return (
                  <button
                    key={char}
                    onClick={() => onSelect(char)}
                    className={`flex items-center gap-3 p-2.5 rounded-2xl border text-left transition-all ${
                      isActive
                        ? 'bg-mode-wash border-mode-tint/40'
                        : 'bg-transparent border-transparent hover:bg-surface-2 hover:border-border'
                    }`}
                  >
                    <span className={`relative overflow-hidden w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 border ${
                      isActive
                        ? 'bg-mode-tint text-on-accent border-transparent'
                        : 'bg-surface-2 text-text-muted border-border'
                    }`}>
                      <CharacterAvatar name={char} fallback={initials(char)} />
                    </span>
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className={`text-[13.5px] font-medium leading-tight truncate ${isActive ? 'text-mode-tint' : 'text-text-primary'}`}>
                        {name}
                      </span>
                      {source && (
                        <span className="text-[11px] text-text-faint leading-tight truncate mt-0.5">{source}</span>
                      )}
                    </span>
                    {isActive && <Check size={16} className="text-mode-tint shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

import { TypewriterText } from '../components/TypewriterText';
import ReactMarkdown from 'react-markdown';
import { markdownComponents } from '../components/markdownComponents';
import { parseMcq } from '../utils/parseMcq';
import { CharacterAvatar } from '../components/CharacterAvatar';
import { SessionSummarySheet } from '../components/SessionSummarySheet';
import { ThemeToggle } from '../components/ThemeToggle';
import { MoodCheckIn, checkedInToday } from '../components/MoodCheckIn';
import { downloadMarkdown, printAsPdf } from '../utils/exportChat';
import remarkGfm from 'remark-gfm';
import { useMicrophone } from '../hooks/useMicrophone';

export default function Inner() {
  const { lang } = useLang();
  const { userApiKey, language, haptic } = useSettings();
  const { checkAndIncrementMessageLimit, user } = useAuth();

  const [input, setInput] = useState('');
  
  const { isListening, toggleListening } = useMicrophone(language, (text) => setInput(text));
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('COUNCIL');
  const [customCharacters, setCustomCharacters] = useState<any[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState(CHARACTERS.MENTOR[0]);
  const [messages, setMessages] = useState<{ id: string; text: string; isAi: boolean; character?: string; imageUrl?: string; attachments?: string[]; mode?: Mode; handoff?: Handoff }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isIncognito, setIsIncognito] = useState(false);
  // Only a reply that just arrived should type itself out. Without this, every
  // chat reopened from history replays its last answer letter by letter.
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  // Files staged in the composer, sent with the next message.
  const [pending, setPending] = useState<{ id: string; name: string; mimeType: string; data: string; preview?: string }[]>([]);
  const [isPlusOpen, setIsPlusOpen] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // Toggling incognito used to change nothing you could see. This drives a
  // short confirmation so the switch is felt, not guessed at.
  const [toast, setToast] = useState<{ id: number; icon: 'on' | 'off'; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (icon: 'on' | 'off', text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), icon, text });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const toggleIncognito = () => {
    triggerVibration();
    const next = !isIncognito;
    setIsIncognito(next);
    showToast(
      next ? 'on' : 'off',
      next
        ? (lang === 'en' ? 'Incognito on — this chat will not be saved' : 'गुप्त मोड चालू — यह चैट सेव नहीं होगी')
        : (lang === 'en' ? 'Incognito off — chats are saved again' : 'गुप्त मोड बंद — चैट फिर से सेव होंगी')
    );
  };
  
  const [showActionMenu, setShowActionMenu] = useState(false);

  const [hash, setHash] = useState(window.location.hash || '#chat');
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showMood, setShowMood] = useState(false);
  const previousViewRef = useRef<'chat' | 'focus' | 'simulator'>('chat');

  useEffect(() => {
    const fetchCustomChars = async () => {
      try {
        const snap = await getDocs(collection(db, 'custom_characters'));
        setCustomCharacters(snap.docs.map(d => d.data()));
      } catch (e) {}
    };
    fetchCustomChars();

    const handleHashChange = () => {
      const newHash = window.location.hash;
      if (newHash === '#chat' || newHash === '#focus' || newHash === '#simulator') {
        previousViewRef.current = newHash.replace('#', '') as 'chat' | 'focus' | 'simulator';
      }
      setHash(newHash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Determine the current view. If a modal is open, keep the underlying view active.
  const view = (hash === '#chat' || hash === '#focus' || hash === '#simulator') 
    ? (hash.replace('#', '') as 'chat' | 'focus' | 'simulator') 
    : previousViewRef.current;

  const isSettingsOpen = hash === '#settings';
  const isHistoryOpen = hash === '#history';
  const isSelectorOpen = hash === '#selector';

  const closeModals = () => {
    window.location.hash = previousViewRef.current;
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Grow the composer with its content, and — just as importantly — shrink it
  // back down once the message is sent or a quick action replaces the text.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [input]);

  // Kept as thin aliases so the many existing call sites stay readable.
  const triggerHaptic = () => haptic('select');
  const triggerVibration = () => haptic('success');

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setMessages([]);
      setCurrentSessionId(null);
      return;
    }
    
    const loadData = async () => {
      try {
        const q = query(collection(db, 'users', user.uid, 'chatSessions'), orderBy('updatedAt', 'desc'));
        const snap = await getDocs(q);
        const fetchedSessions = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title,
            mode: data.mode,
            character: data.character,
            updatedAt: data.updatedAt,
            messages: data.messages || []
          } as ChatSession;
        });
        
        setSessions(fetchedSessions);
        // Do not auto-load the first session. Start with a new chat.
      } catch (e) {
        console.error("Failed to load sessions", e);
      }
    };
    loadData();
  }, [user]);

  // Sync messages and session metadata to Firestore.
  //
  // Debounced, and skipped when the payload is byte-identical to the last one
  // written. Without those two guards this fired on every keystroke-adjacent
  // state change and on every `sessions` update, and each fire re-uploaded the
  // entire message array — attachments included. Opening an old chat used to
  // write the document straight back exactly as it had just been read.
  const lastWriteRef = useRef<string>('');
  const pendingWriteRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user || !currentSessionId || isIncognito) return;
    const sessionMeta = sessions.find(s => s.id === currentSessionId);
    if (!sessionMeta) return;

    const stripUndefined = <T extends object>(obj: T): T => {
      const out = { ...obj };
      (Object.keys(out) as (keyof T)[]).forEach(k => {
        if (out[k] === undefined) delete out[k];
      });
      return out;
    };

    const payload = {
      ...stripUndefined(sessionMeta),
      messages: messages.map(stripUndefined),
    };

    const signature = JSON.stringify(payload);
    if (signature === lastWriteRef.current) return;

    const flush = () => {
      pendingWriteRef.current = null;
      lastWriteRef.current = signature;
      setDoc(doc(db, 'users', user.uid, 'chatSessions', currentSessionId), payload, { merge: true })
        .catch(console.error);
    };
    pendingWriteRef.current = flush;

    const t = setTimeout(flush, 700);
    return () => clearTimeout(t);
  }, [messages, sessions, currentSessionId, user, isIncognito]);

  // A reply that lands right before the user leaves must not be lost to the
  // debounce window.
  useEffect(() => () => { pendingWriteRef.current?.(); }, []);

  useEffect(() => {
    try {
      localStorage.setItem('aura_inner_mode', mode);
      localStorage.setItem('aura_inner_character', selectedCharacter);
    } catch (e) {}
  }, [mode, selectedCharacter]);

  // Attachments reach the model as base64 inside the request body, and base64
  // costs about a third more than the raw bytes. The serverless function that
  // forwards the request accepts 4.5 MB, so 3 MB of file leaves room for the
  // encoding and the rest of the JSON. Rejecting here, with a message, beats
  // letting the upload fail further down where there is nothing useful to say.
  const MAX_FILE_BYTES = 3 * 1024 * 1024;

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const accepted: typeof pending = [];
    for (const file of Array.from(files).slice(0, 4)) {
      if (file.size > MAX_FILE_BYTES) {
        showToast('off', lang === 'en'
          ? `${file.name} is over 3 MB`
          : `${file.name} 3 MB से बड़ी है`);
        continue;
      }
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const base64 = dataUrl.split(',')[1] ?? '';
      accepted.push({
        id: `${Date.now()}_${file.name}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        data: base64,
        preview: file.type.startsWith('image/') ? dataUrl : undefined,
      });
    }
    if (accepted.length) {
      setPending(prev => [...prev, ...accepted]);
      haptic('select');
    }
  };

  const removePending = (id: string) => {
    setPending(prev => prev.filter(p => p.id !== id));
    haptic('tap');
  };

  /** Asks the character for a picture, then renders it into the thread. */
  const generateImageReply = async () => {
    if (isTyping || isGeneratingImage) return;
    const promptText = input.trim();
    if (!promptText) {
      showToast('off', lang === 'en' ? 'Describe the image first' : 'पहले चित्र का वर्णन कीजिए');
      inputRef.current?.focus();
      return;
    }

    haptic('impact');
    const { allowed, isFreeTier } = await checkAndIncrementMessageLimit();
    if (!allowed) return;

    const userMsgId = Date.now().toString();
    const base = [...messages, { id: userMsgId, text: promptText, isAi: false }];
    setMessages(base);
    setInput('');
    setIsGeneratingImage(true);

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = Date.now().toString();
      setCurrentSessionId(sessionId);
      setSessions(prev => [{
        id: sessionId!,
        title: promptText.length > 30 ? promptText.substring(0, 30) + '...' : promptText,
        mode,
        character: mode === 'COUNCIL' ? 'The Council' : mode === 'EMOTION' ? 'The Poets' : mode === 'PSYCHOLOGY' ? 'The Psychologist' : mode === 'TEACHER' ? 'The Teacher' : selectedCharacter,
        updatedAt: Date.now(),
      }, ...prev]);
    }

    try {
      const { dialogue, imagePrompt } = await getInnerVoiceImageResponse(
        promptText, mode, selectedCharacter, messages, userApiKey, language, isFreeTier
      );
      const imageUrl = await generateImage(imagePrompt, '');
      const aiMsgId = (Date.now() + 1).toString();
      setStreamingMsgId(aiMsgId);
      haptic('success');
      setMessages([...base, {
        id: aiMsgId,
        text: dialogue,
        isAi: true,
        character: mode === 'MENTOR' ? selectedCharacter : undefined,
        imageUrl,
      }]);
    } catch (error: any) {
      haptic('error');
      setMessages([...base, {
        id: (Date.now() + 2).toString(),
        text: `[System Error] ${error?.message || 'Could not create that image.'}`,
        isAi: true,
      }]);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const exportMeta = () => {
    const meta = sessions.find(s => s.id === currentSessionId);
    return {
      title: meta?.title || (lang === 'en' ? 'Aura chat' : 'Aura चैट'),
      speaker: meta?.character
        || (mode === 'COUNCIL' ? 'The Council' : mode === 'EMOTION' ? 'The Poets'
          : mode === 'PSYCHOLOGY' ? 'The Psychologist' : mode === 'TEACHER' ? 'The Teacher' : selectedCharacter),
      mode,
      date: new Date(meta?.updatedAt || Date.now()),
    };
  };

  const exportMarkdown = () => {
    downloadMarkdown(exportMeta(), messages);
    haptic('success');
  };

  const exportPdf = () => {
    const opened = printAsPdf(exportMeta(), messages);
    if (!opened) {
      showToast('off', lang === 'en'
        ? 'Allow pop-ups to save as PDF'
        : 'PDF के लिए पॉप-अप allow कीजिए');
      return;
    }
    haptic('success');
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    window.location.hash = 'chat';
  };

  const loadSession = (session: ChatSession) => {
    triggerHaptic();
    setCurrentSessionId(session.id);
    setMode(session.mode);
    if (session.mode !== 'COUNCIL') {
      setSelectedCharacter(session.character);
    }
    setMessages(session.messages || []);
    window.location.hash = 'chat';
  };

  // Called from the history drawer, which already stops the click from
  // bubbling to the row — so this only ever receives the session id.
  const deleteSession = (id: string) => {
    triggerHaptic();
    const updatedSessions = sessions.filter(s => s.id !== id);
    setSessions(updatedSessions);
    
    if (user) {
      deleteDoc(doc(db, 'users', user.uid, 'chatSessions', id)).catch(console.error);
    }

    if (currentSessionId === id) {
      if (updatedSessions.length > 0) {
        loadSession(updatedSessions[0]);
      } else {
        startNewChat();
      }
    }
  };

  const clearCurrentChat = () => {
    triggerHaptic();
    setMessages([]);
    if (currentSessionId) {
      setSessions(prev => prev.filter(s => s.id !== currentSessionId));
      if (user) {
        deleteDoc(doc(db, 'users', user.uid, 'chatSessions', currentSessionId)).catch(console.error);
      }
      setCurrentSessionId(null);
    }
  };

  const switchChat = (newMode: Mode, newChar?: string) => {
    if (mode !== newMode) {
      setCurrentSessionId(null);
      setMessages([]);
    }
    setMode(newMode);
    
    if (newChar) {
      setSelectedCharacter(newChar);
    } else if (newMode === 'MENTOR' || newMode === 'EMOTION') {
      setSelectedCharacter(CHARACTERS[newMode][0]);
    }
    
    if (isSelectorOpen) {
      window.history.back();
    }
  };

  /**
   * Takes the whole conversation into another room.
   *
   * The thread is the subject; the rooms are who you ask about it. So nothing
   * is copied or split — a marker is dropped in, the room changes, and the
   * history travels intact.
   *
   * The framing below is sent to the model but never added to the transcript.
   * The old button wrote "I was discussing this with Shelby…" as though the
   * user had typed it, which put words in their mouth and left them in the
   * exported history for good.
   */
  const moveToRoom = async (to: Mode, toCharacter?: string) => {
    if (to === mode || messages.length === 0 || isTyping) return;

    haptic('impact');
    const { allowed, isFreeTier, justReachedLimit } = await checkAndIncrementMessageLimit();
    if (!allowed) return;

    const from = mode;
    let current = messages;

    if (justReachedLimit) {
      const limitMsg = lang === 'en'
        ? "[System] Daily premium limit reached. Automatically switching to the free version."
        : "[System] आपकी दैनिक प्रीमियम सीमा समाप्त हो गई है। स्वचालित रूप से मुफ्त संस्करण पर स्विच किया जा रहा है।";
      current = [...current, { id: Date.now() + '_limit', text: limitMsg, isAi: true }];
    }

    // Has this room already been in this conversation? A room that is being
    // returned to should notice the gap rather than carry on as if nothing
    // happened.
    const returning = current.some(m => m.mode === to || m.handoff?.to === to);
    const leftFor = ROOM_NAME[from];

    const withMarker = [
      ...current,
      {
        id: Date.now() + '_handoff',
        text: '',
        isAi: false,
        handoff: { from, to, character: from === 'MENTOR' ? selectedCharacter : undefined },
      },
    ];
    setMessages(withMarker);
    setMode(to);
    if (toCharacter) setSelectedCharacter(toCharacter);
    setIsTyping(true);

    const speaker = to === 'MENTOR' ? (toCharacter || selectedCharacter) : ROOM_NAME[to];

    if (currentSessionId) {
      setSessions(prev => prev.map(sn => sn.id === currentSessionId ? {
        ...sn,
        mode: to,
        character: speaker,
        rooms: [...(sn.rooms?.length ? sn.rooms : [from]), to],
        updatedAt: Date.now(),
      } : sn));
    }

    const framing = returning
      ? `[Handoff] This conversation was with you earlier. It then went to ${leftFor}, and has now come back to you. Before anything else, note that they went elsewhere and ask — briefly, in your own voice — what came of it and whether it settled anything. Then carry on from there.`
      : `[Handoff] This conversation has been running with ${leftFor}; you are joining it now. You have the whole exchange above. Do not summarise it back at them. Say what you make of it, in your own voice, and take it forward.`;

    try {
      const response = await getInnerVoiceResponse(
        framing, to, speaker, withMarker, userApiKey, language, isFreeTier,
      );
      const aiMsgId = (Date.now() + 1).toString();
      setStreamingMsgId(aiMsgId);
      haptic('success');
      setMessages([...withMarker, {
        id: aiMsgId, text: response, isAi: true, character: speaker, mode: to,
      }]);
    } catch {
      setMessages([...withMarker, {
        id: (Date.now() + 2).toString(),
        text: `[System Error] ${ROOM_NAME[to]} could not be reached.`,
        isAi: true,
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  /** Kept so the existing Mentor button keeps working. */
  const bringToCouncil = () => moveToRoom('COUNCIL');

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  /**
   * `overrideText` lets a tap send an answer without it having to pass through
   * the input box first — setting state and submitting would race, since the
   * new value is not readable until the next render.
   */
  const handleSubmit = async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault();
    const draft = (overrideText ?? input).trim();
    if ((!draft && pending.length === 0) || isTyping) return;

    haptic('impact');

    const { allowed, isFreeTier, justReachedLimit } = await checkAndIncrementMessageLimit();
    if (!allowed) return;

    let currentMessages = messages;
    if (justReachedLimit) {
      const limitMsgId = Date.now().toString() + "_limit";
      const limitMsg = lang === 'en' 
        ? "[System] Daily premium limit reached. Automatically switching to the free version." 
        : "[System] आपकी दैनिक प्रीमियम सीमा समाप्त हो गई है। स्वचालित रूप से मुफ्त संस्करण पर स्विच किया जा रहा है।";
      currentMessages = [...currentMessages, { id: limitMsgId, text: limitMsg, isAi: true }];
      setMessages(currentMessages);
    }

    const userMessage = draft;
    const outgoing: Attachment[] = pending.map(({ name, mimeType, data }) => ({ name, mimeType, data }));
    const attachmentNames = pending.map(p => p.name);
    setPending([]);
    const userMsgId = Date.now().toString();
    const newMessages = [...currentMessages, { id: userMsgId, text: userMessage, isAi: false, attachments: attachmentNames.length ? attachmentNames : undefined }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    let sessionId = currentSessionId;
    let isNewSession = false;

    if (!sessionId) {
      sessionId = Date.now().toString();
      setCurrentSessionId(sessionId);
      isNewSession = true;
    }

    setSessions(prev => {
      if (isNewSession) {
        return [{
          id: sessionId!,
          title: userMessage.length > 30 ? userMessage.substring(0, 30) + '...' : userMessage,
          mode,
          character: mode === 'COUNCIL' ? 'The Council' : mode === 'EMOTION' ? 'The Poets' : mode === 'PSYCHOLOGY' ? 'The Psychologist' : mode === 'TEACHER' ? 'The Teacher' : selectedCharacter,
          updatedAt: Date.now()
        }, ...prev];
      } else {
        return prev.map(s => s.id === sessionId ? { 
          ...s, 
          mode, 
          character: mode === 'COUNCIL' ? 'The Council' : mode === 'EMOTION' ? 'The Poets' : mode === 'PSYCHOLOGY' ? 'The Psychologist' : mode === 'TEACHER' ? 'The Teacher' : selectedCharacter, 
          updatedAt: Date.now() 
        } : s).sort((a, b) => b.updatedAt - a.updatedAt);
      }
    });

    console.log("Submitting message:", userMessage);
    try {
      const response = await getInnerVoiceResponse(userMessage, mode, selectedCharacter, newMessages.slice(0, -1), userApiKey, language, isFreeTier, outgoing);
      const aiMsgId = (Date.now() + 1).toString();
      setStreamingMsgId(aiMsgId);
      haptic('success');
      const finalMessages = [...newMessages, { id: aiMsgId, text: response, isAi: true, character: mode === 'MENTOR' ? selectedCharacter : undefined }];
      setMessages(finalMessages);
    } catch (error: any) {
      console.error("Error in handleSubmit:", error);
      const errorMsgId = (Date.now() + 2).toString();
      haptic('error');
      const errorMessage = error?.message || "Failed to generate response.";
      const finalMessages = [...newMessages, { id: errorMsgId, text: `[System Error] ${errorMessage}`, isAi: true }];
      setMessages(finalMessages);
    } finally {
      setIsTyping(false);
    }
  };

  const retryLastMessage = async () => {
    const lastUserMsg = [...messages].reverse().find(m => !m.isAi);
    if (!lastUserMsg || isTyping) return;
    
    // Remove the error message if it's the last one
    if (messages[messages.length - 1].isAi && messages[messages.length - 1].text.startsWith('[System Error]')) {
      setMessages(prev => prev.slice(0, -1));
    }
    
    setInput(lastUserMsg.text);
    // We can't easily call handleSubmit directly because of the event, 
    // but we can trigger the logic.
    // Actually, let's just re-run the logic but skip adding the user message again.
    
    triggerHaptic();
    
    const { allowed, isFreeTier, justReachedLimit } = await checkAndIncrementMessageLimit();
    if (!allowed) return;

    let currentMessages = messages[messages.length - 1].isAi && messages[messages.length - 1].text.startsWith('[System Error]')
      ? messages.slice(0, -1)
      : messages;

    if (justReachedLimit) {
      const limitMsgId = Date.now().toString() + "_limit";
      const limitMsg = lang === 'en' 
        ? "[System] Daily premium limit reached. Automatically switching to the free version." 
        : "[System] आपकी दैनिक प्रीमियम सीमा समाप्त हो गई है। स्वचालित रूप से मुफ्त संस्करण पर स्विच किया जा रहा है।";
      currentMessages = [...currentMessages, { id: limitMsgId, text: limitMsg, isAi: true }];
      setMessages(currentMessages);
    }

    setIsTyping(true);

    try {
      const response = await getInnerVoiceResponse(lastUserMsg.text, mode, selectedCharacter, currentMessages.filter(m => m.id !== lastUserMsg.id), userApiKey, language, isFreeTier);
      const aiMsgId = (Date.now() + 1).toString();
      setStreamingMsgId(aiMsgId);
      haptic('success');
      const finalMessages = [...currentMessages, { id: aiMsgId, text: response, isAi: true, character: mode === 'MENTOR' ? selectedCharacter : undefined }];
      setMessages(finalMessages);
    } catch (error: any) {
      const errorMsgId = (Date.now() + 2).toString();
      haptic('error');
      const errorMessage = error?.message || "The connection failed again. Please wait a moment.";
      setMessages([...currentMessages, { id: errorMsgId, text: `[System Error] ${errorMessage}`, isAi: true }]);
    } finally {
      setIsTyping(false);
      setInput('');
    }
  };

  return (
    // data-mode drives the per-mode tint tokens (see index.css)
    <div data-mode={mode} data-incognito={isIncognito || undefined} className="h-[100dvh] bg-bg flex flex-col relative overflow-hidden pt-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,var(--page-glow)_0%,transparent_70%)] pointer-events-none" />
      {/* The mode-colour bloom. Tied to --glow-strength, which the light theme
          zeroes: a tinted cloud reads as depth on black and as a stain on
          white, where the mode colour is carried by the header and bubbles
          instead. */}
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,var(--color-mode-wash)_0%,transparent_38%)] pointer-events-none"
        style={{ opacity: 'calc(0.7 * var(--glow-strength))' }}
      />

      {/* Header / Mode Selection — chat only; Focus and Simulator carry their own */}
      {view === 'chat' && (
        // pt clears the notch / dynamic island when installed as a PWA
        <div className="relative z-20 px-4 sm:px-6 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-border bg-bg/85 backdrop-blur-xl shadow-soft">
          {/* Three zones only: wordmark, mode switcher, one menu. Everything
              else moved into the menu sheet — seven icon buttons plus tabs in
              one bar was the main thing making this screen feel busy. */}
          <div className="w-full flex flex-wrap items-center max-w-4xl mx-auto gap-y-3 gap-x-2">
            {/* Left: wordmark */}
            <div className="flex items-center gap-2.5 shrink-0 order-1">
              <span className="flex items-baseline gap-[3px] select-none">
                <span className="font-display font-bold text-[20px] sm:text-[22px] leading-none tracking-[0.09em] uppercase text-text-primary">
                  Aura
                </span>
                <span className="w-[5px] h-[5px] rounded-full bg-aura-red translate-y-[-1px]" />
              </span>
              {/* A solid badge, and tapping it turns incognito back off —
                  the state should be both visible and reversible from here. */}
              <AnimatePresence>
                {isIncognito && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={toggleIncognito}
                    title={lang === 'en' ? 'Incognito on — tap to turn off' : 'गुप्त मोड चालू — बंद करने के लिए टैप करें'}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-text-primary text-bg text-[11px] font-semibold"
                  >
                    <Ghost size={12} strokeWidth={2} />
                    {lang === 'en' ? 'Incognito' : 'गुप्त'}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Center: Mode Toggle */}
            <div className="order-3 sm:order-2 w-full sm:flex-1 flex justify-center min-w-0">
            {/* Segmented control. Labels are sentence case at a readable size —
                the old 9px all-caps at 0.2em tracking was the least legible
                type in the app, and it sat on the primary navigation. */}
            <div className="flex items-stretch gap-0.5 p-1 bg-surface rounded-2xl border border-border shadow-soft w-full sm:w-auto max-w-full relative">
              {(['COUNCIL', 'MENTOR', 'PSYCHOLOGY'] as const).map((m) => {
                const isActive = mode === m;
                return (
                <button
                    key={m}
                    onClick={() => { if (mode !== m) { triggerHaptic(); switchChat(m); } }}
                    aria-pressed={isActive}
                    className={`relative min-h-[40px] shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-[12.5px] font-medium tracking-[0.01em] transition-colors duration-200 ${isActive ? 'text-on-accent' : 'text-text-muted hover:text-text-primary'}`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeMode"
                        className="absolute inset-0 bg-mode-tint rounded-xl shadow-soft"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                      />
                    )}
                    <span className="relative z-10 whitespace-nowrap">
                      {lang === 'en'
                        ? (m === 'COUNCIL' ? 'Council' : m === 'MENTOR' ? 'Mentor' : 'Psychologist')
                        : (m === 'COUNCIL' ? 'परिषद' : m === 'MENTOR' ? 'गुरु' : 'मनोविज्ञानी')}
                    </span>
                  </button>
                );
              })}
              <div className="relative">
                <button
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  aria-expanded={isMoreOpen}
                  className={`relative min-h-[40px] shrink-0 w-auto px-3.5 sm:px-4 py-2 rounded-xl text-[12.5px] font-medium tracking-[0.01em] transition-colors duration-200 flex items-center justify-center gap-1 ${(mode === 'TEACHER' || mode === 'EMOTION') ? 'text-on-accent' : 'text-text-muted hover:text-text-primary'}`}
                >
                  {(mode === 'TEACHER' || mode === 'EMOTION') && (
                    <motion.div
                      layoutId="activeMode"
                      className="absolute inset-0 bg-mode-tint rounded-xl shadow-soft"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap flex items-center gap-1">
                    {lang === 'en' ? ((mode === 'TEACHER' || mode === 'EMOTION') ? (mode === 'TEACHER' ? 'Teacher' : 'Poets') : 'More') : ((mode === 'TEACHER' || mode === 'EMOTION') ? (mode === 'TEACHER' ? 'शिक्षक' : 'कवि') : 'अन्य')}
                    <ChevronDown size={13} className={`transition-transform ${isMoreOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                
                <AnimatePresence>
                  {isMoreOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsMoreOpen(false)} />
                      {/* Anchored to the button's centre so it reads as coming
                          out of "More" rather than floating off to one side. */}
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        role="menu"
                        /* Centred under "More", but "More" sits at the right of
                           a phone screen, so the sheet was touching the edge.
                           right-0 on small screens keeps a margin. */
                        className="absolute top-full right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 mt-3 mr-1 sm:mr-0 w-40 bg-surface border border-border rounded-2xl p-1.5 shadow-float z-50 origin-top"
                      >
                        {([
                          { id: 'TEACHER', en: 'Teacher', hi: 'शिक्षक' },
                          { id: 'EMOTION', en: 'Poets', hi: 'कवि' },
                        ] as const).map(item => (
                          <button
                            key={item.id}
                            role="menuitem"
                            onClick={() => { triggerHaptic(); switchChat(item.id); setIsMoreOpen(false); }}
                            className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors ${
                              mode === item.id
                                ? 'bg-mode-wash text-mode-tint'
                                : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
                            }`}
                          >
                            {lang === 'en' ? item.en : item.hi}
                            {mode === item.id && <Check size={13} className="shrink-0" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
            </div>

            {/* Right: mentor avatar (when relevant) + new chat + one menu */}
            <div className="flex items-center justify-end gap-1 shrink-0 ml-auto order-2 sm:order-3">
              {(mode === 'MENTOR' || mode === 'EMOTION') && (
                <button
                  onClick={() => { triggerHaptic(); window.location.hash = isSelectorOpen ? 'chat' : 'selector'; }}
                  aria-expanded={isSelectorOpen}
                  title={displayName(selectedCharacter).name}
                  aria-label={lang === 'en'
                    ? `Change ${mode === 'MENTOR' ? 'mentor' : 'poet'}, currently ${displayName(selectedCharacter).name}`
                    : 'बदलें'}
                  /* A bordered pill with a filled avatar, not a bare circle —
                     it has to read as a control you can press. Still no name:
                     that lives in the empty state and the placeholder, and
                     repeating it here cost the chat a whole row. */
                  className={`h-9 flex items-center gap-1 pl-1 pr-1.5 mr-1 rounded-full border transition-colors ${
                    isSelectorOpen
                      ? 'bg-mode-wash border-mode-tint/50'
                      : 'bg-surface border-border hover:border-border-strong'
                  }`}
                >
                  <span className="relative overflow-hidden w-7 h-7 rounded-full bg-mode-tint text-on-accent flex items-center justify-center text-[10.5px] font-bold">
                    <CharacterAvatar name={selectedCharacter} fallback={initials(selectedCharacter)} />
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-text-muted transition-transform ${isSelectorOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
              {/* One surface behind the three controls, so they read as a toolbar
                  rather than three unexplained glyphs floating in the bar. */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-2xl border border-border bg-surface/60">
              <button
                onClick={startNewChat}
                disabled={messages.length === 0}
                className="w-11 h-11 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors rounded-xl hover:bg-surface-2 disabled:opacity-30 disabled:pointer-events-none"
                title={lang === 'en' ? 'New chat' : 'नई चैट'}
              >
                <Plus size={19} strokeWidth={1.6} />
              </button>
              <ThemeToggle />
              <button
                onClick={() => { triggerHaptic(); setIsMenuOpen(true); }}
                aria-expanded={isMenuOpen}
                className="w-11 h-11 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors rounded-xl hover:bg-surface-2"
                title={lang === 'en' ? 'Menu' : 'मेन्यू'}
              >
                <Menu size={19} strokeWidth={1.6} />
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transient confirmation for state changes you cannot otherwise see */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="status"
            aria-live="polite"
            /* Above the composer, not under the header — the header is two rows
               tall on phones and the toast landed on the mode tabs. */
            className="fixed bottom-[max(6rem,calc(env(safe-area-inset-bottom)+5.5rem))] left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2.5 max-w-[92vw] px-4 py-2.5 rounded-full bg-elevated border border-border shadow-float"
          >
            {toast.icon === 'on'
              ? <Ghost size={15} className="text-text-primary shrink-0" strokeWidth={2} />
              : <Eye size={15} className="text-text-muted shrink-0" strokeWidth={2} />}
            <span className="text-[13px] text-text-primary leading-tight">{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMood && (
          <MoodCheckIn
            lang={lang}
            onClose={() => setShowMood(false)}
            onLogged={(e) => {
              // Hand the mood to the conversation so the reply can start from it.
              const mood = ['', 'rough', 'low', 'flat', 'okay', 'good'][e.level];
              setInput(lang === 'en'
                ? `Checking in — I am feeling ${mood} today.${e.note ? ` ${e.note}` : ''}`
                : `आज मन ${['', 'बहुत भारी', 'उदास', 'ठीक-ठाक', 'अच्छा', 'बहुत अच्छा'][e.level]} है।${e.note ? ` ${e.note}` : ''}`);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSummary && (
          <SessionSummarySheet
            messages={messages}
            mode={mode}
            lang={lang}
            onClose={() => setShowSummary(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMenuOpen && (
          <AppMenu
            lang={lang}
            onClose={() => setIsMenuOpen(false)}
            items={[
              {
                icon: History,
                label: lang === 'en' ? 'Chat history' : 'चैट हिस्ट्री',
                hint: sessions.length > 0
                  ? `${sessions.length} ${lang === 'en' ? 'saved' : 'सेव'}`
                  : (lang === 'en' ? 'Nothing saved yet' : 'अभी कुछ नहीं'),
                onClick: () => { window.location.hash = 'history'; },
              },
              {
                icon: Ghost,
                label: lang === 'en' ? 'Incognito' : 'गुप्त मोड',
                hint: lang === 'en' ? 'Do not save this chat' : 'यह चैट सेव न करें',
                active: isIncognito,
                onClick: toggleIncognito,
              },
              {
                icon: Target,
                label: lang === 'en' ? 'Focus' : 'ध्यान',
                hint: lang === 'en' ? 'Deep work timer' : 'गहन कार्य टाइमर',
                onClick: () => { window.location.hash = 'focus'; },
              },
              {
                icon: Gamepad2,
                label: lang === 'en' ? 'Simulator' : 'सिम्युलेटर',
                hint: lang === 'en' ? 'Practical decision test' : 'निर्णय क्षमता परीक्षण',
                onClick: () => { window.location.hash = 'simulator'; },
              },
              {
                icon: ClipboardList,
                label: lang === 'en' ? 'Session summary' : 'सत्र का सार',
                hint: lang === 'en' ? 'What we covered, and what next' : 'क्या हुआ, आगे क्या',
                disabled: messages.length < 2,
                onClick: () => setShowSummary(true),
              },
              {
                icon: FileDown,
                label: lang === 'en' ? 'Save as notes' : 'नोट्स सेव करें',
                hint: lang === 'en' ? 'Markdown file' : 'Markdown फ़ाइल',
                disabled: messages.length === 0,
                onClick: exportMarkdown,
              },
              {
                icon: Printer,
                label: lang === 'en' ? 'Save as PDF' : 'PDF सेव करें',
                hint: lang === 'en' ? 'Opens your print dialog' : 'प्रिंट डायलॉग खुलेगा',
                disabled: messages.length === 0,
                onClick: exportPdf,
              },
              {
                icon: SettingsIcon,
                label: lang === 'en' ? 'Settings' : 'सेटिंग्स',
                onClick: () => { window.location.hash = 'settings'; },
              },
              {
                icon: Trash2,
                label: lang === 'en' ? 'Clear this chat' : 'यह चैट मिटाएं',
                danger: true,
                disabled: messages.length === 0,
                onClick: clearCurrentChat,
              },
            ]}
          />
        )}
      </AnimatePresence>

      {view === 'chat' ? (
        <>
        {/* The character picker itself. Its trigger now lives in the header —
            see the avatar button there — so it costs the chat no space. */}
        <AnimatePresence>
          {isSelectorOpen && (mode === 'MENTOR' || mode === 'EMOTION') && (
            <CharacterPicker
              mode={mode as 'MENTOR' | 'EMOTION'}
              lang={lang}
              options={[
                ...CHARACTERS[mode as 'MENTOR' | 'EMOTION'],
                ...customCharacters.filter(c => c.category === mode).map(c => c.name),
              ]}
              selected={selectedCharacter}
              onSelect={(char) => {
                if (selectedCharacter !== char) switchChat(mode, char);
                window.location.hash = 'chat';
              }}
              onClose={() => { window.location.hash = 'chat'; }}
            />
          )}
        </AnimatePresence>

      <AnimatePresence>
        {isHistoryOpen && (
          <HistoryDrawerComponent
            onClose={closeModals}
            sessions={sessions}
            loadSession={loadSession}
            currentSessionId={currentSessionId}
            deleteSession={deleteSession}
            lang={lang}
          />
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 relative z-10 scrollbar-hide overflow-x-hidden"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={mode + (currentSessionId || 'new')}
            initial={{ opacity: 0, x: mode === 'COUNCIL' || mode === 'EMOTION' ? -20 : 20, filter: 'blur(4px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: mode === 'COUNCIL' || mode === 'EMOTION' ? 20 : -20, filter: 'blur(4px)' }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full max-w-3xl mx-auto min-h-full flex flex-col space-y-4"
          >
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-2 py-6 sm:py-10">
                <div className="relative mb-4 sm:mb-6">
                  <div className="absolute inset-0 -m-5 rounded-full bg-mode-wash blur-2xl opacity-[var(--glow-strength)]" />
                  <div className="relative">
                    {/* In Mentor the room is one person, so their face belongs
                        here. Everywhere else — and in incognito, where nobody is
                        named — the mode's own mark stands. */}
                    {!isIncognito && mode === 'MENTOR' ? (
                      <span className="relative overflow-hidden w-[60px] h-[60px] rounded-2xl flex items-center justify-center bg-surface-2 border border-border text-[17px] font-bold text-text-muted">
                        <CharacterAvatar
                          name={selectedCharacter}
                          fallback={initials(selectedCharacter)}
                          className="rounded-2xl"
                        />
                      </span>
                    ) : isIncognito
                      ? <EyeMark pattern="tomoe" tint="var(--accent)" />
                      : <EyeMark pattern={MODE_EYE[mode]} tint="var(--color-mode-tint)" />}
                  </div>
                </div>

                <h4 className="text-[24px] sm:text-[26px] md:text-[28px] font-display font-medium text-text-primary tracking-[-0.015em] mb-2 text-balance">
                  {isIncognito
                    ? (lang === 'en' ? 'Incognito mode' : 'गुप्त मोड')
                    : mode === 'COUNCIL' ? 'The Council awaits' : mode === 'EMOTION' ? 'The Poets await' : mode === 'TEACHER' ? 'The Teacher is ready' : mode === 'PSYCHOLOGY' ? 'The Psychologist awaits' : `Consult ${selectedCharacter}`}
                </h4>
                {/* One line, and nothing else. The screen should feel like
                    somebody is already sitting there waiting for you. */}
                <p className="text-[14px] sm:text-[15px] text-text-muted mx-auto max-w-[34ch] leading-relaxed">
                  {isIncognito
                    ? (lang === 'en' ? 'Nothing here is written down.' : 'यहाँ कुछ दर्ज नहीं होता।')
                    : mode === 'COUNCIL'
                    ? (lang === 'en' ? 'Five minds. One question.' : 'पांच दिमाग। एक सवाल।')
                    : mode === 'EMOTION'
                    ? (lang === 'en' ? 'Say it. They will find the words.' : 'कह दीजिए। अल्फ़ाज़ वो ढूंढ लेंगे।')
                    : mode === 'TEACHER'
                    ? (lang === 'en' ? 'Ask until it makes sense.' : 'जब तक समझ न आए, पूछते रहिए।')
                    : mode === 'PSYCHOLOGY'
                    /* The old line — "nothing here leaves this room" — was not
                       true: replies come from a model, so messages do leave the
                       device. What is genuinely local is the mood log. */
                    ? (lang === 'en' ? 'Your mood log stays on this phone.' : 'आपका मूड लॉग इसी फ़ोन पर रहता है।')
                    : (lang === 'en' ? 'Say it as it is.' : 'जैसा है वैसा कहिए।')}
                </p>

                {/* An empty room with one line in it gives you nothing to do.
                    Three openers, worded as things you would actually say, and
                    phrased for the room you are standing in. */}
                {!isIncognito && (
                  <div className="flex flex-wrap gap-2 justify-center mt-7 max-w-md">
                    {(STARTERS[mode] || STARTERS.COUNCIL).map(([en, hi]) => (
                      <button
                        key={en}
                        type="button"
                        onClick={() => {
                          haptic('select');
                          setInput(lang === 'en' ? en : hi);
                          document.getElementById('chat-input')?.focus();
                        }}
                        className="text-[12.5px] font-medium bg-surface hover:bg-surface-2 hover:border-mode-tint/50 text-text-body px-3.5 py-2 rounded-full border border-border shadow-soft transition-colors"
                      >
                        {lang === 'en' ? en : hi}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg, mi) => {
                const isError = msg.isAi && msg.text.startsWith('[System Error]');
                const isNotice = msg.isAi && msg.text.startsWith('[System]');
                // Only the newest reply becomes tappable. Leaving old questions
                // live would let a tap answer something three turns back.
                const mcq =
                  msg.isAi && !isError && !isNotice &&
                  mi === messages.length - 1 &&
                  msg.id !== streamingMsgId && !isTyping
                    ? parseMcq(msg.text)
                    : null;
                return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className={`group flex w-full min-w-0 ${msg.isAi ? 'justify-start' : 'justify-end'}`}
                >
                  {/* min-w-0 at every flex level, and max-w-full on the bubble.
                      A flex item defaults to min-width:auto, so one missing
                      link lets a wide table or code block stretch the bubble
                      clean off the screen where it gets clipped unreachably. */}
                  <div className={`flex flex-col min-w-0 ${
                    /* Formatted answers — headings, steps, tables — need room;
                       your own messages read better kept narrow. */
                    msg.isAi ? 'max-w-[92%] md:max-w-[78%] items-start' : 'max-w-[85%] md:max-w-[70%] items-end'
                  }`}>
                    {msg.isAi && !isError && !isNotice && (() => {
                      const speaker = speakerOf(msg.text, msg.character);
                      const room = msg.character
                        || (mode === 'EMOTION' ? 'The Poets' : mode === 'TEACHER' ? 'The Teacher'
                          : mode === 'PSYCHOLOGY' ? 'The Psychologist' : 'The Council');
                      return (
                        <span className="flex items-center gap-2 mb-1.5 ml-0.5">
                          {speaker && !isIncognito && (
                            /* The face arrives a beat after the bubble, which
                               reads as someone turning to answer rather than
                               the whole row appearing at once. */
                            <motion.span
                              key={speaker}
                              initial={{ opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.08 }}
                              className="relative overflow-hidden w-7 h-7 rounded-full shrink-0 flex items-center justify-center bg-surface-2 border border-mode-tint/40 text-[9.5px] font-bold text-text-muted"
                            >
                              <CharacterAvatar name={speaker} fallback={initials(speaker)} />
                            </motion.span>
                          )}
                          <span className="text-[11px] uppercase tracking-[0.08em] text-mode-tint font-mono truncate">
                            {/* "Sun Tzu (The Art of War)" is how the roster
                                stores him; the label wants just the name. */}
                            {speaker ? displayName(speaker).name : room}
                          </span>
                        </span>
                      );
                    })()}
                    <div
                      className={`px-4 py-3 text-[14.5px] leading-[1.65] min-w-0 max-w-full ${
                        isError
                          ? 'bg-accent-wash text-text-body rounded-2xl rounded-tl-md border border-aura-red/30'
                          : isNotice
                          ? 'bg-surface-2 text-text-muted rounded-2xl border border-border text-[13px]'
                          : msg.isAi
                          ? 'bg-surface text-text-primary rounded-2xl rounded-tl-md border border-border shadow-soft'
                          /* Your bubble takes the colour of the room you are
                             in — gold with the Poets, blue with the
                             Psychologist, red in Council and Mentor. */
                          : 'bg-mode-tint text-on-accent font-medium rounded-2xl rounded-br-md whitespace-pre-wrap shadow-soft'
                      }`}
                    >
                      {msg.isAi ? (
                        msg.id === streamingMsgId ? (
                          <TypewriterText
                            text={speakerOf(msg.text, msg.character) ? withoutSpeakerPrefix(msg.text) : msg.text}
                            animate={true}
                            speed={25}
                            markdown={true}
                            onDone={() => setStreamingMsgId(null)}
                          />
                        ) : (
                          <div className="markdown-body">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                              {(() => {
                                const body = mcq ? mcq.body : msg.text;
                                return speakerOf(msg.text, msg.character) ? withoutSpeakerPrefix(body) : body;
                              })()}
                            </ReactMarkdown>
                          </div>
                        )
                      ) : (
                        <>
                          {msg.attachments?.length ? (
                            <span className="flex flex-wrap gap-1.5 mb-2">
                              {msg.attachments.map(n => (
                                <span
                                  key={n}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/15 text-[11.5px] max-w-[12rem]"
                                >
                                  <FileText size={12} className="shrink-0 opacity-80" />
                                  <span className="truncate">{n}</span>
                                </span>
                              ))}
                            </span>
                          ) : null}
                          {msg.text}
                        </>
                      )}

                      {msg.imageUrl && (
                        <div className="mt-3 relative rounded-xl overflow-hidden border border-border max-w-sm">
                          <img
                            src={msg.imageUrl}
                            alt={lang === 'en' ? 'Generated illustration' : 'बनाया गया चित्र'}
                            className="w-full h-auto block"
                          />
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = msg.imageUrl!;
                              link.download = `inner-${Date.now()}.png`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="absolute bottom-2 right-2 p-2 bg-bg/90 border border-border hover:border-border-strong text-text-body hover:text-text-primary rounded-lg transition-all backdrop-blur-sm"
                            title={lang === 'en' ? 'Download Image' : 'चित्र डाउनलोड करें'}
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* A quiz answer should be one tap, not a line retyped.
                        Sending the label with the text keeps the reply
                        unambiguous when two options read similarly. */}
                    {mcq && (
                      <div className="grid gap-2 mt-2.5 w-full max-w-[420px]">
                        {mcq.options.map(o => (
                          <button
                            key={o.label}
                            onClick={() => { haptic('select'); handleSubmit(undefined, `${o.label}) ${o.text}`); }}
                            className="min-h-[46px] text-left px-3.5 py-2.5 rounded-xl bg-surface border border-border shadow-soft hover:border-mode-tint hover:bg-surface-2 transition-all flex items-center gap-3 group/opt"
                          >
                            <span className="w-6 h-6 rounded-full bg-surface-2 border border-border text-text-muted group-hover/opt:bg-mode-tint group-hover/opt:text-on-accent group-hover/opt:border-transparent flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors">
                              {o.label}
                            </span>
                            <span className="text-[14px] leading-snug text-text-body">{o.text}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Actions sit under the bubble so they never crowd the
                        text. Your own messages get Copy too — you often want
                        to reuse a prompt you already wrote. */}
                    {!isNotice && (
                      <div className={`flex items-center gap-1 mt-1.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity ${msg.isAi ? 'ml-1' : 'mr-1'}`}>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(msg.text);
                              setCopiedMsgId(msg.id);
                              setTimeout(() => setCopiedMsgId(prev => (prev === msg.id ? null : prev)), 1600);
                              haptic('success');
                            } catch (err) {
                              console.error('Clipboard write failed', err);
                            }
                          }}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] text-text-faint hover:text-text-primary hover:bg-surface-2 transition-colors"
                          title={lang === 'en' ? 'Copy message' : 'कॉपी करें'}
                        >
                          {copiedMsgId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                          {copiedMsgId === msg.id
                            ? (lang === 'en' ? 'Copied' : 'कॉपी हुआ')
                            : (lang === 'en' ? 'Copy' : 'कॉपी')}
                        </button>

                        {isError && (
                          <button
                            onClick={retryLastMessage}
                            disabled={isTyping}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] text-aura-red hover:bg-aura-red/10 transition-colors disabled:opacity-40"
                          >
                            <RefreshCcw size={12} className={isTyping ? 'animate-spin' : ''} />
                            {lang === 'en' ? 'Retry' : 'पुनः प्रयास'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
                );
              })}

              {isGeneratingImage && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-surface border border-creative/25 rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-3 shadow-soft">
                    <Sparkles size={15} className="text-creative animate-pulse shrink-0" />
                    <span className="text-[13px] text-text-muted">
                      {lang === 'en' ? 'Making the picture…' : 'चित्र बन रहा है…'}
                    </span>
                  </div>
                </motion.div>
              )}

              {isTyping && !isGeneratingImage && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-surface px-5 py-3 rounded-2xl rounded-bl-none border border-border flex items-center gap-3 w-fit max-w-[80%]">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-mode-tint rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-mode-tint rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-mode-tint rounded-full animate-bounce" />
                    </div>
                    <span className="text-[11px] uppercase tracking-widest text-text-muted font-bold">
                      {mode === 'COUNCIL' 
                        ? (lang === 'en' ? 'Council is analyzing...' : 'काउंसिल विश्लेषण कर रही है...')
                        : mode === 'EMOTION'
                        ? (lang === 'en' ? 'Poets are listening...' : 'कवि सुन रहे हैं...')
                        : mode === 'TEACHER'
                        ? (lang === 'en' ? 'Teacher is thinking...' : 'शिक्षक सोच रहे हैं...')
                        : mode === 'PSYCHOLOGY'
                        ? (lang === 'en' ? 'Psychologist is reflecting...' : 'मनोवैज्ञानिक विश्लेषण कर रहे हैं...')
                        : (lang === 'en' ? `${selectedCharacter} is thinking...` : `${selectedCharacter} सोच रहे हैं...`)}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} className="h-4" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Just the bar — no bordered tray around it. The extra bottom padding
          lifts it clear of the iOS home indicator. */}
      <div className="relative z-20 px-3 sm:px-4 pt-3 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))] bg-bg flex flex-col gap-2">
        {mode === 'PSYCHOLOGY' && (
          <div className="flex gap-2 px-2 pb-1 max-w-3xl mx-auto w-full">
            <button
              type="button"
              onClick={() => { haptic('select'); setShowMood(true); }}
              className="text-[12px] font-medium bg-surface hover:bg-surface-2 text-text-body px-3.5 py-2 rounded-full border border-border shadow-soft transition-colors flex items-center gap-1.5"
            >
              <HeartPulse size={13} className="text-mode-tint" />
              {checkedInToday()
                ? (lang === 'en' ? 'Mood logged today' : 'आज दर्ज है')
                : (lang === 'en' ? 'Check in' : 'आज कैसा लग रहा है?')}
            </button>
          </div>
        )}
        {mode === 'EMOTION' && (
          <>
            <button 
              onClick={() => { setInput(lang === 'en' ? 'Answer this as a ghazal.'  : 'इसका जवाब ग़ज़ल में दीजिए।'); document.getElementById('chat-input')?.focus(); }}
              className="text-[12px] font-medium bg-surface hover:bg-surface-2 text-text-body px-3 py-1.5 rounded-full border border-border shrink-0 transition-colors"
            >
              {lang === 'en' ? 'Ghazal' : 'ग़ज़ल'}
            </button>
            <button 
              onClick={() => { setInput(lang === 'en' ? 'Just one sher.'  : 'बस एक शेर।'); document.getElementById('chat-input')?.focus(); }}
              className="text-[12px] font-medium bg-surface hover:bg-surface-2 text-text-body px-3 py-1.5 rounded-full border border-border shrink-0 transition-colors"
            >
              {lang === 'en' ? 'Short sher' : 'एक शेर'}
            </button>
            <button 
              onClick={() => { setInput(lang === 'en' ? 'Free verse, no rhyme.'  : 'आज़ाद नज़्म, बिना क़ाफ़िये।'); document.getElementById('chat-input')?.focus(); }}
              className="text-[12px] font-medium bg-surface hover:bg-surface-2 text-text-body px-3 py-1.5 rounded-full border border-border shrink-0 transition-colors"
            >
              {lang === 'en' ? 'Free verse' : 'आज़ाद नज़्म'}
            </button>
            <button 
              onClick={() => { setInput(lang === 'en' ? 'Say it gently — leave some light in it.'  : 'नरमी से कहिए — थोड़ी रौशनी रहने दीजिए।'); document.getElementById('chat-input')?.focus(); }}
              className="text-[12px] font-medium bg-surface hover:bg-surface-2 text-text-body px-3 py-1.5 rounded-full border border-border shrink-0 transition-colors"
            >
              {lang === 'en' ? 'Hopeful' : 'उम्मीद'}
            </button>
            <button 
              onClick={() => { setInput(lang === 'en' ? 'Do not soften it.'  : 'इसे हल्का मत कीजिए।'); document.getElementById('chat-input')?.focus(); }}
              className="text-[12px] font-medium bg-surface hover:bg-surface-2 text-text-body px-3 py-1.5 rounded-full border border-border shrink-0 transition-colors"
            >
              {lang === 'en' ? 'Unsparing' : 'बेरहम'}
            </button>
          </>
        )}

        {(mode === 'TEACHER' || (mode === 'MENTOR' && messages.length > 0)) && (
          <div className="flex overflow-x-auto scrollbar-hide gap-2 px-2 pb-1 max-w-3xl mx-auto w-full">
            {mode === 'MENTOR' && messages.length > 0 && (
              <button 
                type="button"
                onClick={bringToCouncil}
                className="text-[12px] font-medium bg-mode-wash hover:bg-accent-wash text-mode-tint px-3 py-1.5 rounded-full border border-mode-tint/20 shrink-0 transition-colors flex items-center gap-1.5"
              >
                <Users size={12} /> {lang === 'en' ? 'Escalate to Council' : 'परिषद को सौंपें'}
              </button>
            )}
            {mode === 'TEACHER' && (
              <>
                <button
                  onClick={() => {
                    haptic('select');
                    setInput(lang === 'en'
                      ? 'Quiz me on what we just covered. Ask 5 multiple-choice questions, one at a time, and wait for my answer before revealing whether I was right.'
                      : 'अभी जो पढ़ा उस पर मुझसे सवाल पूछिए। 5 बहुविकल्पीय सवाल, एक-एक करके — मेरा जवाब आने के बाद ही बताइए सही है या गलत।');
                    inputRef.current?.focus();
                  }}
                  className="text-[12px] font-medium bg-surface hover:bg-surface-2 text-text-body px-3.5 py-2 rounded-full border border-border shadow-soft shrink-0 transition-colors flex items-center gap-1.5"
                >
                  <GraduationCap size={13} /> {lang === 'en' ? 'Quiz me' : 'सवाल पूछिए'}
                </button>
                <button 
                  onClick={() => { setInput(lang === 'en' ? 'Make detailed notes on this topic' : 'इस विषय पर विस्तृत नोट्स बनाएं'); document.getElementById('chat-input')?.focus(); }}
                  className="text-[12px] font-medium bg-surface hover:bg-surface-2 text-text-body px-3 py-1.5 rounded-full border border-border shrink-0 transition-colors"
                >
                  📝 {lang === 'en' ? 'Make Notes' : 'नोट्स बनाएं'}
                </button>
                <button 
                  onClick={() => { setInput(lang === 'en' ? 'Analyze this step-by-step' : 'इसको स्टेप-बाय-स्टेप समझाइए'); document.getElementById('chat-input')?.focus(); }}
                  className="text-[12px] font-medium bg-surface hover:bg-surface-2 text-text-body px-3 py-1.5 rounded-full border border-border shrink-0 transition-colors"
                >
                  🔍 {lang === 'en' ? 'Analyze' : 'विश्लेषण करें'}
                </button>
                  <button 
                    onClick={() => { setInput(lang === 'en' ? "Explain this in simple language" : "इसे आसान भाषा में समझाइए"); document.getElementById('chat-input')?.focus(); }}
                    className="text-[12px] font-medium bg-surface hover:bg-surface-2 text-text-body px-3 py-1.5 rounded-full border border-border shrink-0 transition-colors"
                  >
                    {lang === 'en' ? 'Simple' : 'आसान भाषा'}
                  </button>
                  <button 
                    onClick={() => { setInput(lang === 'en' ? "Take me through this step by step" : "इसे स्टेप बाय स्टेप कराइए"); document.getElementById('chat-input')?.focus(); }}
                    className="text-[12px] font-medium bg-surface hover:bg-surface-2 text-text-body px-3 py-1.5 rounded-full border border-border shrink-0 transition-colors"
                  >
                    {lang === 'en' ? 'Step by step' : 'स्टेप बाय स्टेप'}
                  </button>
                  <button 
                    onClick={() => { setInput(lang === 'en' ? "I am still not getting it — where does this usually confuse people?" : "अभी भी समझ नहीं आया — लोग यहाँ कहाँ अटकते हैं?"); document.getElementById('chat-input')?.focus(); }}
                    className="text-[12px] font-medium bg-surface hover:bg-surface-2 text-text-body px-3 py-1.5 rounded-full border border-border shrink-0 transition-colors"
                  >
                    {lang === 'en' ? 'Still stuck' : 'अभी भी अटका हूँ'}
                  </button>
              </>
            )}
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className={`max-w-3xl mx-auto w-full flex flex-col gap-2 bg-surface rounded-[22px] border shadow-pop px-3 py-2 focus-within:border-mode-tint/50 transition-all ${isIncognito ? 'border-dashed border-border-strong' : 'border-border'}`}
        >
          {/* Staged files sit above the input so they never squeeze it */}
          {pending.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {pending.map(f => (
                <span
                  key={f.id}
                  className="group/att flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-xl bg-surface-2 border border-border max-w-[13rem]"
                >
                  {f.preview
                    ? <img src={f.preview} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                    : <span className="w-7 h-7 rounded-lg bg-bg border border-border flex items-center justify-center shrink-0">
                        <FileText size={13} className="text-text-muted" />
                      </span>}
                  <span className="text-[12px] text-text-body truncate flex-1">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removePending(f.id)}
                    aria-label={lang === 'en' ? `Remove ${f.name}` : 'हटाएं'}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-text-faint hover:text-aura-red hover:bg-accent-wash shrink-0"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* One + for everything that is not plain text */}
            <div className="relative mb-0 shrink-0">
              <button
                type="button"
                onClick={() => { haptic('tap'); setIsPlusOpen(v => !v); }}
                aria-expanded={isPlusOpen}
                aria-label={lang === 'en' ? 'Add attachment' : 'फ़ाइल जोड़ें'}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
                  isPlusOpen ? 'bg-surface-2 text-text-primary' : 'text-text-faint hover:text-text-primary hover:bg-surface-2'
                }`}
              >
                <Plus size={19} className={`transition-transform duration-200 ${isPlusOpen ? 'rotate-45' : ''}`} />
              </button>

              <AnimatePresence>
                {isPlusOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsPlusOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      role="menu"
                      className="absolute bottom-full left-0 mb-2 w-56 bg-elevated border border-border rounded-2xl p-1.5 shadow-float z-50 origin-bottom-left"
                    >
                      {[
                        {
                          icon: Paperclip,
                          label: lang === 'en' ? 'Attach a file' : 'फ़ाइल लगाएं',
                          hint: lang === 'en' ? 'PDF, doc, image, notes' : 'PDF, doc, चित्र, नोट्स',
                          onClick: () => fileRef.current?.click(),
                        },
                        {
                          icon: Camera,
                          label: lang === 'en' ? 'Take a photo' : 'फ़ोटो लीजिए',
                          hint: lang === 'en' ? 'Snap a page or a whiteboard' : 'पन्ना या बोर्ड',
                          onClick: () => cameraRef.current?.click(),
                        },
                        {
                          icon: ImagePlus,
                          label: lang === 'en' ? 'Generate an image' : 'चित्र बनवाइए',
                          hint: lang === 'en' ? 'Describe it, then send' : 'वर्णन कीजिए, फिर भेजिए',
                          onClick: generateImageReply,
                        },
                      ].map(item => (
                        <button
                          key={item.label}
                          type="button"
                          role="menuitem"
                          onClick={() => { item.onClick(); setIsPlusOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-text-body hover:bg-surface-2 hover:text-text-primary transition-colors"
                        >
                          <item.icon size={17} strokeWidth={1.7} className="shrink-0 text-text-muted" />
                          <span className="flex flex-col min-w-0">
                            <span className="text-[13.5px] font-medium leading-tight">{item.label}</span>
                            <span className="text-[11.5px] text-text-faint leading-tight mt-0.5">{item.hint}</span>
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/plain,text/markdown,.doc,.docx,.csv"
              className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
            {/* capture= opens the camera directly on a phone */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
          <textarea
            id="chat-input"
            ref={inputRef}
            value={input}
            onChange={(e) => {
              // A light tick per keystroke, throttled — an unthrottled
              // vibrate() on every key reads as one continuous rattle.
              if (e.target.value.length > input.length) haptic('tap', 90);
              setInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            rows={1}
            placeholder={mode === 'COUNCIL' 
              ? (lang === 'en' ? "Message the Council..." : "परिषद को संदेश भेजें...")
              : mode === 'EMOTION'
              ? (lang === 'en' ? "Express your feelings..." : "अपनी भावनाएं व्यक्त करें...")
              : mode === 'TEACHER'
              ? (lang === 'en' ? "Ask the Teacher a question..." : "शिक्षक से प्रश्न पूछें...")
              : mode === 'PSYCHOLOGY'
              ? (lang === 'en' ? "Talk to the Psychologist..." : "मनोवैज्ञानिक से बात करें...")
              : (lang === 'en' ? `Message ${selectedCharacter}...` : `${selectedCharacter} को संदेश भेजें...`)}
            /* The wrapper's focus-within ring is the focus indicator here, so
               the textarea suppresses its own to avoid a doubled outline. */
            className="flex-1 bg-transparent border-none py-2 text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus-visible:outline-none resize-none overflow-y-auto scrollbar-hide ml-1"
            style={{ minHeight: '40px', maxHeight: '150px' }}
          />
          <button
            type="button"
            onClick={() => { haptic('impact'); toggleListening(); }}
            aria-pressed={isListening}
            className={`w-10 h-10 mb-0 flex items-center justify-center rounded-xl transition-all flex-shrink-0 ${isListening ? 'bg-mode-tint text-on-accent animate-pulse' : 'text-text-muted hover:bg-surface-2 hover:text-text-primary'}`}
            title={lang === 'en' ? (isListening ? 'Stop recording' : 'Start dictation') : (isListening ? 'रिकॉर्डिंग रोकें' : 'बोलकर लिखें')}
          >
            <Mic size={18} />
          </button>
          <button
            type="submit"
            disabled={(!input.trim() && pending.length === 0) || isTyping}
            title={lang === 'en' ? 'Send' : 'भेजें'}
            className="w-10 h-10 mb-0 flex items-center justify-center rounded-xl text-on-accent bg-mode-tint disabled:opacity-100 disabled:bg-surface-2 disabled:text-text-faint transition-all hover:brightness-110 active:scale-95 flex-shrink-0"
          >
            <Send size={17} />
          </button>
          </div>
        </form>
      </div>
      </>
      ) : view === 'focus' ? (
        <Focus />
      ) : (
        <Simulator />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && <Settings onClose={closeModals} />}
    </div>
  );
}
