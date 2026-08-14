import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../context/SettingsContext';

/**
 * Renders a ```mermaid code block as a diagram — flowcharts, sequences,
 * mind maps, timelines.
 *
 * mermaid is ~1 MB, so it is imported dynamically: a chat that never contains
 * a diagram never pays for it.
 */

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(m => m.default);
  }
  return mermaidPromise;
}

let seq = 0;

export const Mermaid: React.FC<{ chart: string }> = ({ chart }) => {
  const { theme } = useSettings();
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const idRef = useRef(`aura-mermaid-${++seq}`);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    (async () => {
      try {
        const mermaid = await loadMermaid();
        const css = getComputedStyle(document.documentElement);
        const read = (v: string) => css.getPropertyValue(v).trim();

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          fontFamily: read('--font-sans') || 'Inter, sans-serif',
          theme: 'base',
          themeVariables: {
            background: read('--surface'),
            primaryColor: read('--surface-2'),
            primaryTextColor: read('--text-primary'),
            primaryBorderColor: read('--color-mode-tint') || read('--accent'),
            lineColor: read('--border-strong'),
            secondaryColor: read('--surface'),
            tertiaryColor: read('--bg'),
            textColor: read('--text-body'),
            fontSize: '13px',
          },
        });

        const { svg: out } = await mermaid.render(idRef.current, chart.trim());
        if (!cancelled) setSvg(out);
      } catch {
        // A half-written diagram is common while a reply is still streaming in;
        // fall back to showing the source rather than an error.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => { cancelled = true; };
  }, [chart, theme]);

  if (failed) {
    return (
      <pre><code>{chart}</code></pre>
    );
  }

  if (!svg) {
    return (
      <div className="my-3 h-24 rounded-xl border border-border bg-surface-2 animate-pulse" aria-hidden />
    );
  }

  return (
    <div
      className="my-3 p-3 rounded-xl border border-border bg-surface overflow-x-auto [&_svg]:max-w-none [&_svg]:h-auto"
      role="img"
      aria-label="Diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
