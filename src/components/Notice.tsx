import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { X, Megaphone, Sparkles, AlertTriangle } from 'lucide-react';
import { db } from '../firebase';

/**
 * The one banner an admin can put in front of everybody.
 *
 * Live rather than fetched once: an outage notice that only appears on the
 * next cold start is not much use, so this listens and appears the moment it
 * is published.
 *
 * Dismissal is keyed to the notice's own text. A new announcement therefore
 * shows again, while the one someone has already read and closed stays closed
 * — without an admin having to remember to reset anything.
 */

type Kind = 'info' | 'update' | 'warning';

interface Notice {
  active?: boolean;
  title?: string;
  body?: string;
  kind?: Kind;
}

const ICON: Record<Kind, React.ComponentType<any>> = {
  info: Megaphone,
  update: Sparkles,
  warning: AlertTriangle,
};

const TONE: Record<Kind, string> = {
  info: 'border-border bg-surface',
  update: 'border-creative/40 bg-creative-wash',
  warning: 'border-warn/40 bg-surface-2',
};

const ACCENT: Record<Kind, string> = {
  info: 'text-text-muted',
  update: 'text-creative',
  warning: 'text-warn',
};

/** A stable key for one notice's content. */
function keyFor(n: Notice) {
  return `aura_notice_${btoa(unescape(encodeURIComponent(`${n.title || ''}|${n.body || ''}`))).slice(0, 24)}`;
}

export const NoticeBanner: React.FC = () => {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const stop = onSnapshot(
      doc(db, 'settings', 'global'),
      snap => {
        const data = snap.data() as { notice?: Notice } | undefined;
        const n = data?.notice;
        if (!n?.active || (!n.title && !n.body)) {
          setNotice(null);
          return;
        }
        let seen = false;
        try { seen = localStorage.getItem(keyFor(n)) === '1'; } catch {}
        setClosed(seen);
        setNotice(n);
      },
      () => setNotice(null),   // no permission, offline — simply no banner
    );
    return stop;
  }, []);

  if (!notice || closed) return null;

  const kind: Kind = notice.kind && ICON[notice.kind] ? notice.kind : 'info';
  const Icon = ICON[kind];

  const dismiss = () => {
    try { localStorage.setItem(keyFor(notice), '1'); } catch {}
    setClosed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        role="status"
        className={`relative z-30 mx-3 sm:mx-4 mt-2 rounded-2xl border px-3.5 py-3 flex items-start gap-3 shadow-soft ${TONE[kind]}`}
      >
        <Icon size={16} className={`shrink-0 mt-0.5 ${ACCENT[kind]}`} />
        <div className="min-w-0 flex-1">
          {notice.title && (
            <p className="text-[13.5px] font-semibold text-text-primary leading-snug">{notice.title}</p>
          )}
          {notice.body && (
            <p className="text-[13px] text-text-body leading-relaxed mt-0.5">{notice.body}</p>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 w-7 h-7 -mr-1 -mt-0.5 flex items-center justify-center rounded-lg text-text-faint hover:text-text-primary hover:bg-surface-2 transition-colors"
        >
          <X size={15} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
