/**
 * Keeps the app the size of the space the keyboard leaves it.
 *
 * The Android shell is configured with windowSoftInputMode="adjustResize", and
 * when that works the WebView shrinks on its own and there is nothing to do.
 * It does not always work — an older build of the shell, an OEM WebView, or a
 * window that has gone fullscreen will all leave the page at its full height
 * while the keyboard covers the bottom of it, which is what pushes the
 * composer off the screen.
 *
 * visualViewport reports the part of the page the user can actually see, so
 * the difference between it and the layout viewport is exactly how much the
 * keyboard is covering. When the WebView has already resized itself that
 * difference is zero and this changes nothing — so it corrects the broken case
 * without disturbing the working one.
 *
 * Exposed as --kb-inset, which index.css subtracts from the app's height.
 */

export function trackKeyboardInset(): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};

  let last = -1;

  const apply = () => {
    // offsetTop matters: when the page is scrolled up to reveal a focused
    // field, part of the gap is above the viewport rather than below it.
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    // Small differences are the browser chrome settling, not a keyboard.
    const inset = covered > 80 ? Math.round(covered) : 0;
    if (inset === last) return;
    last = inset;
    document.documentElement.style.setProperty('--kb-inset', `${inset}px`);
  };

  apply();
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);

  return () => {
    vv.removeEventListener('resize', apply);
    vv.removeEventListener('scroll', apply);
  };
}
