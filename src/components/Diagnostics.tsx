import React, { useCallback, useEffect, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';

/**
 * What this device actually reports.
 *
 * Three things were fixed and then reported still broken — the keyboard, the
 * fingerprint, the haptics — and every one of them was verified inside the
 * published APK from here. That leaves no way to tell whether a fix failed or
 * simply never reached the phone, and guessing again is worse than asking the
 * device.
 *
 * Every line is read live from the running app. One screenshot of this settles
 * which build is installed, whether each native plugin answered at all, and
 * what the keyboard is doing to the viewport.
 */

interface Line { label: string; value: string; ok?: boolean }

export const Diagnostics: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [lines, setLines] = useState<Line[]>([]);
  const [kb, setKb] = useState<Line[]>([]);

  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();

  const collect = useCallback(async () => {
    const out: Line[] = [];

    out.push({ label: 'Chal raha hai', value: isNative ? 'Android app' : 'Browser', ok: true });

    // App version and the web bundle on top of it.
    if (isNative) {
      try {
        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
        const cur: any = await CapacitorUpdater.current();
        out.push({ label: 'APK version', value: cur?.native || '?', ok: !!cur?.native });
        out.push({ label: 'Web bundle', value: cur?.bundle?.version || '?', ok: true });
      } catch (e: any) {
        out.push({ label: 'APK version', value: 'updater plugin nahi hai — bahut purana APK', ok: false });
      }
    }

    // Biometric: report exactly what the plugin said, or that it is absent.
    if (isNative) {
      try {
        const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
        const r: any = await BiometricAuth.checkBiometry();
        out.push({
          label: 'Biometric',
          value: `isAvailable=${r?.isAvailable} deviceIsSecure=${r?.deviceIsSecure} type=${r?.biometryType}${r?.reason ? ' · ' + r.reason : ''}`,
          ok: !!(r?.isAvailable || r?.deviceIsSecure),
        });
      } catch (e: any) {
        out.push({ label: 'Biometric', value: `plugin missing — ${e?.message || 'no answer'}`, ok: false });
      }
    } else {
      out.push({
        label: 'Biometric (web)',
        value: (window as any).PublicKeyCredential ? 'WebAuthn available' : 'WebAuthn nahi',
        ok: !!(window as any).PublicKeyCredential,
      });
    }

    // Haptics: fire one so it can be felt, and say whether the call survived.
    if (isNative) {
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Medium });
        out.push({ label: 'Haptics', value: 'plugin ne buzz kiya — mehsoos hua?', ok: true });
      } catch (e: any) {
        out.push({ label: 'Haptics', value: `plugin missing — ${e?.message || 'no answer'}`, ok: false });
      }
    } else {
      out.push({
        label: 'Haptics (web)',
        value: typeof navigator.vibrate === 'function' ? 'navigator.vibrate hai' : 'nahi hai',
        ok: typeof navigator.vibrate === 'function',
      });
    }

    // What the keyboard plugin itself reports — the one number that is true
    // whether or not the webview resizes. Read live, not from storage.
    if (isNative) {
      try {
        const { lastKeyboardHeight } = await import('../utils/keyboardInset');
        const h = lastKeyboardHeight();
        out.push({
          label: 'Keyboard plugin height',
          value: h ? `${h}px` : 'plugin ne abhi tak kuch nahi bataya',
          ok: h > 0,
        });
      } catch {
        out.push({ label: 'Keyboard plugin', value: 'nahi mila', ok: false });
      }
    }

    // A worker still controlling the page inside the shell is the suspect for
    // both the hanging plugin import and the unstyled layout.
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      out.push({
        label: 'Service worker',
        value: regs && regs.length
          ? `${regs.length} registered${navigator.serviceWorker.controller ? ', controlling this page' : ''}`
          : 'none',
        ok: !(isNative && regs && regs.length),
      });
    } catch {}

    setLines(out);
  }, [isNative]);

  useEffect(() => { collect(); }, [collect]);

  /**
   * Keyboard geometry, live — and remembered.
   *
   * The live numbers are only true while the keyboard is up, and the keyboard
   * goes down the moment a screenshot is taken on some phones. So the extremes
   * are kept too: the smallest viewport and the largest gap seen since this
   * screen opened. One screenshot after typing then carries what happened
   * while the keyboard was actually there.
   */
  useEffect(() => {
    // Kept across openings. The extremes reset every time this screen was
    // reopened, so a reading taken after closing the keyboard showed nothing —
    // which is exactly the sequence anyone naturally follows.
    const KEY = 'aura_kb_extremes';
    const saved = (() => {
      try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
    })();
    let minInner = saved.minInner ?? Infinity;
    let minVv = saved.minVv ?? Infinity;
    let maxGap = saved.maxGap ?? 0;
    let maxInset = saved.maxInset ?? 0;
    let minRoot = saved.minRoot ?? Infinity;

    const read = () => {
      const vv = window.visualViewport;
      const inner = window.innerHeight;
      const vvH = vv ? Math.round(vv.height) : inner;
      const gap = vv ? Math.round(inner - vv.height - vv.offsetTop) : 0;
      const inset = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--kb-inset') || '0', 10) || 0;
      const root = Math.round(document.getElementById('root')?.getBoundingClientRect().height || 0);

      minInner = Math.min(minInner, inner);
      minVv = Math.min(minVv, vvH);
      maxGap = Math.max(maxGap, gap);
      maxInset = Math.max(maxInset, inset);
      minRoot = Math.min(minRoot, root);
      try {
        localStorage.setItem(KEY, JSON.stringify({ minInner, minVv, maxGap, maxInset, minRoot }));
      } catch {}

      setKb([
        { label: 'innerHeight', value: `${inner}  (sabse kam ${minInner})` },
        { label: 'visualViewport', value: `${vvH}  (sabse kam ${minVv})` },
        { label: 'gap', value: `${gap}  (sabse zyada ${maxGap})` },
        { label: '--kb-inset', value: `${inset}px  (sabse zyada ${maxInset}px)` },
        { label: '#root height', value: `${root}  (sabse kam ${minRoot})` },
        { label: 'screen', value: `${Math.round(window.screen.height)} · dpr ${window.devicePixelRatio}` },
        { label: 'plugin height', value: `${(window as any).__auraKbHeight || 0}px` },
        { label: 'kya hua', value: String((window as any).__auraKbNote || '—') },
      ]);
    };

    read();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', read);
    vv?.addEventListener('scroll', read);
    window.addEventListener('resize', read);
    // 200ms so a keyboard that opens and closes quickly is still caught.
    const t = setInterval(read, 200);
    return () => {
      vv?.removeEventListener('resize', read);
      vv?.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
      clearInterval(t);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div className="relative bg-bg border-t sm:border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-float max-h-[88dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-[15px] font-semibold text-text-primary">Diagnostics</h2>
          <div className="flex items-center gap-1">
            <button onClick={collect} className="p-2 text-text-muted" aria-label="Refresh"><RefreshCw size={17} /></button>
            <button onClick={onClose} className="p-2 text-text-muted" aria-label="Close"><X size={18} /></button>
          </div>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-4">
          <div className="space-y-2">
            {lines.map(l => (
              <div key={l.label} className="flex flex-col">
                <span className="text-[11px] uppercase tracking-wide text-text-faint">{l.label}</span>
                <span className={`text-[13px] break-words ${l.ok === false ? 'text-aura-red' : 'text-text-primary'}`}>{l.value}</span>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-faint mb-1.5">
              Keyboard — neeche wale box par tap kijiye, kuch type kijiye
            </p>
            <p className="text-[12px] text-text-muted mb-2">
              Numbers yaad rehte hain — keyboard band karne ke baad bhi. Screen band
              karke dobara kholenge to bhi rahenge.{' '}
              <button
                className="underline text-text-faint"
                onClick={() => { try { localStorage.removeItem('aura_kb_extremes'); } catch {} location.reload(); }}
              >
                reset
              </button>
            </p>
            {/* The numbers only mean anything while the keyboard is up, and
                asking someone to open Settings mid-typing is not a test. The
                input is here so the measurement can be taken and screenshotted
                in one place. */}
            <input
              type="text"
              placeholder="Yahan tap karein…"
              className="w-full mb-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-[14px] text-text-primary outline-none focus:border-accent"
            />
            <div className="rounded-xl border border-border bg-surface-2 divide-y divide-border">
              {kb.map(l => (
                <div key={l.label} className="flex items-center justify-between px-3 py-2">
                  <span className="text-[12px] text-text-muted">{l.label}</span>
                  <span className="text-[13px] tabular-nums text-text-primary">{l.value}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[12px] text-text-faint">
            Is screen ka screenshot bhej dijiye — isse pata chal jayega ki kaun sa build chal raha hai
            aur kya jawab de raha hai.
          </p>
        </div>
      </div>
    </div>
  );
};
