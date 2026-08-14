import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Android-style 3x3 unlock pattern.
 *
 * The drawn path is reported as a dot sequence ("0-4-8"), which is then salted
 * and hashed exactly like a PIN — the pattern itself is never stored.
 */

const SIZE = 3;
const DOTS = Array.from({ length: SIZE * SIZE }, (_, i) => i);

interface Props {
  onComplete: (pattern: string) => void;
  /** Bump to clear the drawing, e.g. after a wrong attempt. */
  resetKey?: number;
  disabled?: boolean;
  error?: boolean;
}

export const PatternPad: React.FC<Props> = ({ onComplete, resetKey = 0, disabled, error }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState<number[]>([]);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    setPath([]);
    setCursor(null);
    drawing.current = false;
  }, [resetKey]);

  const centreOf = (index: number, rect: DOMRect) => {
    const col = index % SIZE;
    const row = Math.floor(index / SIZE);
    const step = rect.width / SIZE;
    return { x: step * (col + 0.5), y: step * (row + 0.5) };
  };

  const hitTest = (clientX: number, clientY: number): number | null => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const step = rect.width / SIZE;
    for (const i of DOTS) {
      const c = centreOf(i, rect);
      // Generous radius — a pattern should be quick, not precise.
      if (Math.hypot(x - c.x, y - c.y) < step * 0.34) return i;
    }
    return null;
  };

  const track = useCallback((clientX: number, clientY: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCursor({ x: clientX - rect.left, y: clientY - rect.top });

    const hit = hitTest(clientX, clientY);
    if (hit === null) return;
    setPath(prev => (prev.includes(hit) ? prev : [...prev, hit]));
  }, []);

  const start = (clientX: number, clientY: number) => {
    if (disabled) return;
    drawing.current = true;
    setPath([]);
    track(clientX, clientY);
  };

  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setCursor(null);
    setPath(prev => {
      if (prev.length >= 4) onComplete(prev.join('-'));
      return prev;
    });
  };

  useEffect(() => {
    const move = (e: PointerEvent) => { if (drawing.current) track(e.clientX, e.clientY); };
    const up = () => finish();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [track]);

  const rect = boxRef.current?.getBoundingClientRect();
  const lineColor = error ? 'var(--danger)' : 'var(--accent)';

  return (
    <div
      ref={boxRef}
      onPointerDown={(e) => { e.preventDefault(); start(e.clientX, e.clientY); }}
      className={`relative w-[248px] h-[248px] touch-none select-none mx-auto ${disabled ? 'opacity-50' : ''}`}
      role="application"
      aria-label="Unlock pattern"
    >
      {rect && (path.length > 0) && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
          {path.slice(1).map((dot, i) => {
            const a = centreOf(path[i], rect);
            const b = centreOf(dot, rect);
            return <line key={`${path[i]}-${dot}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={lineColor} strokeWidth="3.5" strokeLinecap="round" />;
          })}
          {cursor && (() => {
            const a = centreOf(path[path.length - 1], rect);
            return <line x1={a.x} y1={a.y} x2={cursor.x} y2={cursor.y} stroke={lineColor} strokeWidth="3.5" strokeLinecap="round" opacity="0.55" />;
          })()}
        </svg>
      )}

      <div className="grid grid-cols-3 w-full h-full">
        {DOTS.map(i => {
          const active = path.includes(i);
          return (
            <div key={i} className="flex items-center justify-center">
              <span
                className={`rounded-full transition-all duration-150 ${
                  active
                    ? `w-6 h-6 ${error ? 'bg-danger' : 'bg-aura-red'}`
                    : 'w-4 h-4 bg-border-strong'
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
