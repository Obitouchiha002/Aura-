/**
 * Keeps the app the size of the space the keyboard leaves it.
 *
 * Two things can happen when a keyboard opens, and the app has to survive
 * both.
 *
 * The webview may resize itself — Android does this for a window with
 * adjustResize — and then there is nothing to do: the layout is already the
 * right size and any correction here would shrink it twice.
 *
 * Or the webview may not resize, in which case the composer is below the fold
 * and the browser scrolls it into view instead. That is what "the chat box
 * jumps up and there is a black gap under it" is: the page panned, and what
 * shows beneath the composer is the bottom of a layout that is still full
 * height. Measuring the viewport cannot detect this, because on such a webview
 * neither innerHeight nor visualViewport changes at all — which is why three
 * rounds of measurement all came back reporting nothing had happened.
 *
 * The keyboard plugin reports its own height natively, and that number is true
 * whichever of the two the webview does. So the height comes from the plugin,
 * and whether to use it is decided by watching what the viewport actually did.
 *
 * Exposed as --kb-inset, which index.css subtracts from the app's height.
 */

const set = (px: number) =>
  document.documentElement.style.setProperty('--kb-inset', `${Math.max(0, Math.round(px))}px`);

/**
 * The height the plugin last reported, readable from anywhere.
 *
 * Diagnostics used to read this from storage, written on a previous run, so it
 * said "keyboard never opened" while the keyboard was open. A live value makes
 * one screenshot enough.
 */
let lastKeyboard = 0;
export const lastKeyboardHeight = () => lastKeyboard;

/** Also on window, so the diagnostics table can poll it without an import. */
function remember(px: number) {
  lastKeyboard = px;
  try { (window as any).__auraKbHeight = px; } catch {}
}

function isNativeShell(): boolean {
  return typeof window !== 'undefined'
    && !!(window as any).Capacitor?.isNativePlatform?.();
}

/** The web path: the visual viewport is honest in a real browser. */
function trackViaViewport(): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};

  let last = -1;
  const apply = () => {
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    const inset = covered > 80 ? Math.round(covered) : 0;
    if (inset === last) return;
    last = inset;
    set(inset);
  };

  apply();
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
  return () => {
    vv.removeEventListener('resize', apply);
    vv.removeEventListener('scroll', apply);
  };
}

/**
 * The shell path: take the height from the plugin, then check whether the
 * webview already accounted for it.
 */
async function trackViaPlugin(): Promise<() => void> {
  const { Keyboard } = await import('@capacitor/keyboard');
  const handles: Array<{ remove: () => void }> = [];

  /** Height before the keyboard opened, to tell a resize from a pan. */
  let heightBefore = window.innerHeight;

  const onShow = (info: any) => {
    const kb = Number(info?.keyboardHeight) || 0;
    if (kb <= 0) return;
    remember(kb);

    // Apply first, correct after.
    //
    // This used to wait for a timer and only then decide, which meant that if
    // the check did not run — or ran while the webview was mid-settle — nothing
    // was applied at all and the composer stayed underneath the keyboard. Doing
    // it in this order, the worst case is a correction rather than no effect.
    set(kb);
    window.scrollTo(0, 0);

    // Then, once the webview has settled, withdraw it if the space was already
    // taken away natively — otherwise it would be taken twice.
    const recheck = () => {
      const shrank = heightBefore - window.innerHeight;
      set(shrank > kb * 0.6 ? 0 : kb);
      window.scrollTo(0, 0);
    };
    setTimeout(recheck, 60);
    setTimeout(recheck, 300);
  };

  const onHide = () => {
    set(0);
    // Recorded while the keyboard is down, so the next comparison is against a
    // full-height viewport.
    setTimeout(() => { heightBefore = window.innerHeight; }, 100);
    window.scrollTo(0, 0);
  };

  for (const [name, fn] of [
    ['keyboardWillShow', onShow], ['keyboardDidShow', onShow],
    ['keyboardWillHide', onHide], ['keyboardDidHide', onHide],
  ] as const) {
    try { handles.push(await Keyboard.addListener(name as any, fn as any)); } catch {}
  }

  return () => handles.forEach(h => { try { h.remove(); } catch {} });
}

export function trackKeyboardInset(): () => void {
  set(0);

  if (!isNativeShell()) return trackViaViewport();

  // The viewport listener stays on as well: on a webview that does resize it
  // simply reports 0, and it costs nothing to have both agree.
  const stopViewport = trackViaViewport();
  let stopPlugin: (() => void) | null = null;
  trackViaPlugin().then(stop => { stopPlugin = stop; }).catch(() => {});

  return () => { stopViewport(); stopPlugin?.(); };
}
