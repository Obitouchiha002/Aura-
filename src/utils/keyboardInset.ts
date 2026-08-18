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

    // The plugin fires before the webview settles. A frame later innerHeight
    // tells us which of the two happened: if it shrank, the layout is already
    // correct and adding the inset would take the same space away twice.
    requestAnimationFrame(() => {
      setTimeout(() => {
        const shrank = heightBefore - window.innerHeight;
        set(shrank > kb * 0.6 ? 0 : kb);
        // The page may already have panned to reveal the field. Undoing that
        // is what puts the composer back at the bottom where it belongs.
        window.scrollTo(0, 0);
      }, 50);
    });
  };

  const onHide = () => {
    set(0);
    heightBefore = window.innerHeight;
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
