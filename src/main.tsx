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
 * Dismiss the Android splash screen once React has actually painted.
 *
 * The splash is configured not to hide itself, so the launch image stays up
 * until there is something behind it — otherwise the user sees a blank webview
 * for a moment. It has to be dismissed from here, or it never goes away.
 *
 * The import is dynamic and the failure is swallowed on purpose: on the web
 * there is no native layer and nothing to hide.
 */
requestAnimationFrame(() => {
  import('@capacitor/splash-screen')
    .then(({ SplashScreen }) => SplashScreen.hide())
    .catch(() => {});
});
