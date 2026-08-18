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

import { registerPlugin } from '@capacitor/core';

/**
 * Writes the inset, unless the native side has taken over.
 *
 * MainActivity starts publishing on the first inset pass, which is after this
 * module has already installed its listeners — so without this check the web
 * path could still overwrite an exact native value with its own guess a
 * moment later.
 */
const set = (px: number) => {
  if ((window as any).__auraNativeKb) return;
  document.documentElement.style.setProperty('--kb-inset', `${Math.max(0, Math.round(px))}px`);
};

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
  note('plugin ne bataya');
}

/**
 * A one-line account of what happened the last time a field was focused.
 *
 * If this ever has to be diagnosed again, the question is only ever which of
 * three things occurred: the plugin reported a height, the webview resized
 * itself, or neither. Recording it turns the next report into an answer rather
 * than another round of guessing.
 */
function note(what: string) {
  try { (window as any).__auraKbNote = what; } catch {}
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
 *
 * The plugin is reached through the bridge rather than by importing the
 * package. A dynamic import of a plugin chunk is what left the biometric check
 * hanging on a device — the promise neither resolved nor rejected — and this
 * had exactly the same shape: if the import never settled, no listener was
 * ever registered and the composer stayed under the keyboard with nothing in
 * the logs to say why. registerPlugin is already in the main bundle, so there
 * is no chunk to fetch and nothing to wait on.
 */
function trackViaPlugin(): () => void {
  const Keyboard: any =
    (window as any).Capacitor?.Plugins?.Keyboard || registerPlugin('Keyboard');
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
      const resized = shrank > kb * 0.6;
      set(resized ? 0 : kb);
      note(resized ? `webview khud shrink hua (${shrank})` : `inset lagaya (${kb})`);
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
    // Not awaited: addListener resolves with a handle, but the listener itself
    // is registered immediately. Awaiting it was one more promise that could
    // fail to settle before the first keyboard ever opened.
    try {
      Promise.resolve(Keyboard.addListener(name, fn))
        .then((h: any) => { if (h?.remove) handles.push(h); })
        .catch(() => {});
    } catch {}
  }

  return () => handles.forEach(h => { try { h.remove(); } catch {} });
}

export function trackKeyboardInset(): () => void {
  set(0);

  if (!isNativeShell()) return trackViaViewport();

  // MainActivity publishes the keyboard height from WindowInsets, which is the
  // platform's own answer and does not depend on a plugin event arriving. When
  // it is doing that, everything below would only be a second opinion — and a
  // worse one — so it stands down.
  if ((window as any).__auraNativeKb) {
    return () => {};
  }
  const onNative = () => {};
  window.addEventListener('aura:keyboard', onNative);

  // A field was focused and half a second later nothing had changed: no
  // plugin event, no resize. That is the one outcome the numbers alone cannot
  // show, and it is worth naming.
  const onFocus = (e: Event) => {
    const el = e.target as HTMLElement | null;
    if (!el || !/^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
    const before = window.innerHeight;
    const kbBefore = lastKeyboard;
    note('focus hua, jawab ka intezaar');
    setTimeout(() => {
      if (lastKeyboard === kbBefore && window.innerHeight === before) {
        note('kuch nahi hua — plugin chup, webview waisa hi');
      }
    }, 600);
  };
  document.addEventListener('focusin', onFocus, true);

  // The viewport listener stays on as well: on a webview that does resize it
  // simply reports 0, and it costs nothing to have both agree.
  const stopViewport = trackViaViewport();
  const stopPlugin = trackViaPlugin();

  return () => {
    window.removeEventListener('aura:keyboard', onNative);
    document.removeEventListener('focusin', onFocus, true);
    stopViewport();
    stopPlugin();
  };
}
