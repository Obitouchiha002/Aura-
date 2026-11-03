import React, { useState } from 'react';
import { MessagesSquare, ChevronRight } from 'lucide-react';

/**
 * Why the Council answered the way it did.
 *
 * The room argues in private and one of them brings out the conclusion. This
 * is the argument — folded, because a person who came with a problem wants an
 * answer, not a transcript to read through before they get one.
 *
 * It opens for the one question that makes it worth keeping: why. Who
 * disagreed, who was overruled, and what the room thought of them while they
 * were not listening.
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
        <MessagesSquare size={14} className="text-text-faint shrink-0" />
        <span className="text-[12.5px] text-text-muted flex-1">
          {open ? 'How the room got there' : `Why — the room argued about this (${lines.length})`}
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
