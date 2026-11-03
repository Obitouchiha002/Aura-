import React, { useState } from 'react';
import { Users, ChevronRight } from 'lucide-react';

/**
 * The room talking among themselves.
 *
 * The Council answers the person directly — that is the meeting, and it stays
 * on screen. This is the other half: the five seconds where they argue with
 * each other rather than with you, which is the part that makes it a room and
 * not a panel of narrators.
 *
 * Folded away, because it is not addressed to the person and interrupting the
 * answer with it would bury the answer. Open it when you want to know whether
 * they are really talking to each other.
 *
 * Rendered from a ```room fence, the same mechanism the mermaid diagrams use —
 * react-markdown escapes raw HTML, so <details> would arrive as text, and
 * adding rehype-raw to get one collapsible would also let every model reply
 * put arbitrary HTML into the page.
 */
export const RoomAside: React.FC<{ source: string }> = ({ source }) => {
  const [open, setOpen] = useState(false);

  // "Tywin Lannister: they are not listening." — the name is the part that
  // has to survive; anything without a colon is still shown, just unattributed.
  const lines = source
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const m = l.match(/^\*{0,2}([^:*]{2,40})\*{0,2}\s*:\s*(.+)$/);
      return m ? { who: m[1].trim(), said: m[2].trim() } : { who: '', said: l };
    });

  if (!lines.length) return null;

  return (
    <div className="my-3 rounded-xl border border-border bg-surface/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-2 transition-colors"
      >
        <Users size={14} className="text-text-faint shrink-0" />
        <span className="text-[12.5px] text-text-muted flex-1">
          {open ? 'The room, among themselves' : `The room is also talking to each other (${lines.length})`}
        </span>
        <ChevronRight
          size={14}
          className={`text-text-faint shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border">
          {lines.map((l, i) => (
            <p key={i} className="text-[13.5px] leading-relaxed text-text-body">
              {l.who && (
                <span className="text-text-primary font-medium">{l.who}</span>
              )}
              {l.who && <span className="text-text-faint"> — </span>}
              {l.said}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
