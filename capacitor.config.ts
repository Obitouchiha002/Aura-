import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android shell.
 *
 * The web assets are bundled into the APK rather than pointed at a remote URL,
 * so the app opens instantly and the shell works without a connection. Only the
 * model calls go out, to /api/generate on the deployed site — see VITE_API_BASE
 * in the android build script.
 */
const config: CapacitorConfig = {
  appId: 'in.lzworth.aurashakti',
  appName: 'Aura Shakti',
  webDir: 'dist',

  android: {
    // The app is dark; a light webview flash on launch is jarring.
    backgroundColor: '#0A0A0A',
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchAutoHide: false,       // hidden by the app once React has mounted
      backgroundColor: '#0A0A0A',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',               // light glyphs, for the dark ground
      backgroundColor: '#0A0A0A',
      overlaysWebView: false,
    },
  },
};

export default config;
