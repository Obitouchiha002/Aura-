import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * How long the animated boot screen is guaranteed to stay up, in ms.
 *
 * The blink lands at 0.45s. Without a floor a fast load would tear the mark
 * away mid-blink, which reads as a flicker rather than as a logo. This is the
 * only deliberate delay in the launch path, and it is spent on something the
 * user is looking at.
 */
const BOOT_FLOOR_MS = 750;
const bootShownAt = performance.now();

/** Fade out the inline boot screen and take it out of the tree. */
function dismissBootScreen() {
  const boot = document.getElementById('boot');
  if (!boot) return;

  const wait = Math.max(0, BOOT_FLOOR_MS - (performance.now() - bootShownAt));
  setTimeout(() => {
    boot.style.opacity = '0';
    // Matches the transition in index.html; removing it early would cut the fade.
    setTimeout(() => boot.remove(), 400);
  }, wait);
}

/**
 * Dismiss the Android splash screen once React has actually painted.
 *
 * The splash is configured not to hide itself, so the launch image stays up
 * until there is something behind it — otherwise the user sees a blank webview
 * for a moment. index.html drops it as soon as the boot screen is on glass;
 * this is the fallback for the case where the bridge was not ready that early.
 *
 * The import is dynamic and the failure is swallowed on purpose: on the web
 * there is no native layer and nothing to hide.
 */
requestAnimationFrame(() => {
  import('@capacitor/splash-screen')
    .then(({ SplashScreen }) => SplashScreen.hide())
    .catch(() => {});

  dismissBootScreen();

  /**
   * Tell the updater this build starts.
   *
   * A live-update bundle that never reports itself ready is rolled back to the
   * previous one, which is what stops a bad release bricking the app. Skipping
   * this call would make every update roll back a few seconds after it ran.
   */
  import('@capgo/capacitor-updater')
    .then(({ CapacitorUpdater }) => CapacitorUpdater.notifyAppReady())
    .catch(() => {});
});
