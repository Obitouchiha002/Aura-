import React, { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';

/**
 * Tells the user an update is happening.
 *
 * Live updates were silent: the app checked, downloaded and swapped bundles
 * with nothing on screen, so there was no way to tell whether it had worked —
 * or that the feature existed at all. It looked broken because it was
 * invisible.
 *
 * This shows the download while it runs and, when the new version is ready,
 * offers to apply it now instead of waiting for the app to be closed and
 * reopened.
 *
 * Nothing here renders on the web, where there is no updater at all.
 */

type Phase = 'idle' | 'downloading' | 'ready';

export const UpdateBanner: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [percent, setPercent] = useState(0);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let handles: Array<{ remove: () => void }> = [];
    let cancelled = false;

    (async () => {
      // web, or a shell built before the plugin existed
      if (!(window as any).Capacitor?.isNativePlatform?.()) return;
      let CapacitorUpdater: any;
      try {
        ({ CapacitorUpdater } = await import('@capgo/capacitor-updater'));
      } catch {
        return;
      }
      if (cancelled) return;

      const add = async (name: string, fn: (e: any) => void) => {
        try { handles.push(await CapacitorUpdater.addListener(name, fn)); } catch {}
      };

      await add('download', (e: any) => {
        setPhase('downloading');
        setPercent(Math.max(0, Math.min(100, Math.round(e?.percent ?? 0))));
      });
      // Either of these means the bundle is on the device and queued.
      await add('downloadComplete', () => setPhase('ready'));
      await add('updateAvailable', () => setPhase('ready'));
      await add('downloadFailed', () => setPhase('idle'));
    })();

    return () => {
      cancelled = true;
      handles.forEach(h => { try { h.remove(); } catch {} });
    };
  }, []);

  const applyNow = async () => {
    setApplying(true);
    try {
      const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
      // Same swap the app would do on its own when backgrounded — just now.
      await CapacitorUpdater.reload();
    } catch {
      setApplying(false);
    }
  };

  if (phase === 'idle') return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[95] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-border bg-elevated shadow-float px-4 py-3">
        {phase === 'downloading' ? (
          <div className="flex items-center gap-3">
            <Download size={18} className="text-accent shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-primary font-medium">Naya version aa raha hai</p>
              <div className="mt-1.5 h-1 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-text-muted tabular-nums shrink-0">{percent}%</span>
          </div>
        ) : (
          /* Stacked rather than inline: at 360px a button beside this text
             squeezed the label into four lines. */
          <>
            <div className="flex items-start gap-3">
              <RefreshCw size={18} className="text-accent shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text-primary font-medium">Naya version taiyaar</p>
                <p className="text-xs text-text-muted mt-0.5">
                  App band karne par apne aap lag jayega.
                </p>
              </div>
            </div>
            <button
              onClick={applyNow}
              disabled={applying}
              className="mt-3 w-full rounded-full bg-accent text-on-accent text-[13px] font-semibold py-2.5 disabled:opacity-60"
            >
              {applying ? 'Lag raha hai…' : 'Abhi lagayein'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
