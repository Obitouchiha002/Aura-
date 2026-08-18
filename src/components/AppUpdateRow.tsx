import React, { useCallback, useEffect, useState } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import { checkForAppUpdate, downloadAndInstall, installedVersion, type ApkRelease } from '../utils/apkUpdate';

/**
 * Updating the app without leaving it.
 *
 * Everything web ships over the air; a native change still needs a new build,
 * and that used to mean going to the site in a browser and finding the file.
 * One tap here downloads it inside the app and hands it to Android's installer.
 *
 * The system's install confirmation at the end is not skippable — no app may
 * install another app silently. So this is one tap and then Android's prompt,
 * which is as close to automatic as the platform allows.
 */

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'current'; version: string }
  | { kind: 'available'; release: ApkRelease }
  | { kind: 'downloading'; release: ApkRelease; percent: number }
  | { kind: 'installing' }
  | { kind: 'failed'; reason: string };

export const AppUpdateRow: React.FC<{ Row: React.ComponentType<any> }> = ({ Row }) => {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [native, setNative] = useState<string | null>(null);

  useEffect(() => { installedVersion().then(setNative); }, []);

  // Checked once on open, so a waiting update is seen without being asked for.
  useEffect(() => {
    let alive = true;
    checkForAppUpdate().then(r => {
      if (alive && r) setState({ kind: 'available', release: r });
    });
    return () => { alive = false; };
  }, []);

  const check = useCallback(async () => {
    setState({ kind: 'checking' });
    const r = await checkForAppUpdate();
    const cur = native || (await installedVersion()) || '?';
    setState(r ? { kind: 'available', release: r } : { kind: 'current', version: cur });
  }, [native]);

  const install = useCallback(async (release: ApkRelease) => {
    setState({ kind: 'downloading', release, percent: 0 });
    try {
      await downloadAndInstall(release, percent =>
        setState(s => (s.kind === 'downloading' ? { ...s, percent } : s)));
      setState({ kind: 'installing' });
    } catch (e: any) {
      setState({ kind: 'failed', reason: e?.message?.slice(0, 70) || 'Update nahi ho paya' });
    }
  }, []);

  // Nothing to offer in a browser, where there is no APK.
  if (!native) return null;

  const hint =
    state.kind === 'checking' ? 'Dekh raha hoon…'
    : state.kind === 'current' ? `App ${state.version} — aap latest par hain`
    : state.kind === 'available' ? `Naya version ${state.release.version} · ${(state.release.size / 1048576).toFixed(1)} MB`
    : state.kind === 'downloading' ? `Download ho raha hai — ${state.percent}%`
    : state.kind === 'installing' ? 'Android ka install screen khul gaya'
    : state.kind === 'failed' ? state.reason
    : `App ${native}`;

  const busy = state.kind === 'checking' || state.kind === 'downloading' || state.kind === 'installing';

  return (
    <>
      <Row
        icon={state.kind === 'current' ? CheckCircle2 : Download}
        label="App update"
        hint={hint}
      >
        {state.kind === 'available' || state.kind === 'failed' ? (
          <button
            onClick={() => install(state.kind === 'available' ? state.release : (state as any).release)}
            disabled={state.kind === 'failed'}
            className="shrink-0 rounded-full bg-accent text-on-accent text-xs font-semibold px-3.5 py-2 disabled:opacity-60"
          >
            Update karein
          </button>
        ) : (
          <button
            onClick={check}
            disabled={busy}
            className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-primary disabled:opacity-60"
          >
            Check karein
          </button>
        )}
      </Row>

      {state.kind === 'downloading' && (
        <div className="px-4 pb-3 -mt-1">
          <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${state.percent}%` }}
            />
          </div>
        </div>
      )}
    </>
  );
};
