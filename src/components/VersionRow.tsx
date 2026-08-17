import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Which version is actually running, and a way to go and look for a newer one.
 *
 * Live updates arrive silently, which left no way to answer the only question
 * that matters when one does not seem to have arrived: what am I running? This
 * shows the web bundle and the installed APK separately, because they move
 * independently — an update over the air changes the first and not the second.
 *
 * The check is the same one the app does on its own at launch; having it on a
 * button just means it can be done on demand instead of waiting.
 */

interface Versions {
  bundle: string;
  native: string;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'current' }
  | { kind: 'found'; version: string }
  | { kind: 'failed'; reason: string };

/** Resolves the plugin, or null on the web / a shell built without it. */
async function updater(): Promise<any | null> {
  // The plugin ships a web implementation that answers without doing anything,
  // so asking the platform is what actually keeps this off the website.
  if (!(window as any).Capacitor?.isNativePlatform?.()) return null;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    return CapacitorUpdater;
  } catch {
    return null;
  }
}

export const VersionRow: React.FC<{ Row: React.ComponentType<any> }> = ({ Row }) => {
  const [versions, setVersions] = useState<Versions | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    let alive = true;
    (async () => {
      const up = await updater();
      if (!up || !alive) return;
      try {
        const cur = await up.current();
        if (!alive) return;
        setVersions({
          // 'builtin' is what the plugin reports before any update has been
          // applied. Saying so is more useful than showing the word.
          bundle: cur?.bundle?.version && cur.bundle.version !== 'builtin'
            ? cur.bundle.version
            : cur?.native || '—',
          native: cur?.native || '—',
        });
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const check = useCallback(async () => {
    setStatus({ kind: 'checking' });
    const up = await updater();
    if (!up) {
      setStatus({ kind: 'failed', reason: 'Updates sirf app mein chalte hain' });
      return;
    }
    try {
      const latest = await up.getLatest();
      // The endpoint answers "nothing new" without a version field.
      if (!latest?.version || latest.version === versions?.bundle) {
        setStatus({ kind: 'current' });
        return;
      }
      setStatus({ kind: 'found', version: latest.version });
      // The download and the banner that reports it are handled by the
      // plugin's own auto-update pass; nothing to drive from here.
    } catch (e: any) {
      setStatus({ kind: 'failed', reason: e?.message?.slice(0, 60) || 'Check nahi ho paya' });
    }
  }, [versions?.bundle]);

  // Nothing to say in a browser, where there is no APK and no updater.
  if (!versions) return null;

  const hint =
    status.kind === 'checking' ? 'Dekh raha hoon…'
    : status.kind === 'current' ? 'Aap latest version par hain'
    : status.kind === 'found' ? `Naya version ${status.version} mil gaya — download ho raha hai`
    : status.kind === 'failed' ? status.reason
    : versions.bundle === versions.native
      ? `App ${versions.native}`
      : `App ${versions.native} · update ${versions.bundle}`;

  return (
    <Row icon={RefreshCw} label="Version" hint={hint}>
      <button
        onClick={check}
        disabled={status.kind === 'checking'}
        className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-primary disabled:opacity-60"
      >
        Check karein
      </button>
    </Row>
  );
};
