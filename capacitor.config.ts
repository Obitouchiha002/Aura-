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
    /**
     * Google sign-in on Android.
     *
     * The plugin needs the provider named here — without it the native
     * account picker is never wired up and signInWithGoogle fails at the
     * first call. `skipNativeAuth: false` means the native layer signs into
     * Firebase itself; the JS SDK is then given the same credential so
     * Firestore rules see a signed-in user too.
     */
    /**
     * Live updates for the web layer.
     *
     * Nearly all of this app is web assets, so nearly every change can reach a
     * phone without a new APK. The app asks /api/updates on launch, downloads
     * a newer bundle in the background, and runs it from the next start.
     *
     * Native changes — a plugin, an icon, a permission — still need a build.
     */
    CapacitorUpdater: {
      autoUpdate: true,
      updateUrl: 'https://aurashakti.vercel.app/api/updates',
      // If a bundle fails to call notifyAppReady it is rolled back rather than
      // leaving the app stuck on a build that cannot start.
      appReadyTimeout: 10000,
      responseTimeout: 20,
      directUpdate: false,
    },

    /**
     * The webview is resized by Android alone, through
     * windowSoftInputMode="adjustResize" in the manifest. Nothing here should
     * resize anything as well.
     *
     * `resize` is an iOS-only option and never did anything on Android.
     * `resizeOnFullScreen` is a workaround for apps that draw under the status
     * bar, which this one does not — StatusBar has overlaysWebView: false. On a
     * normal window it sets the webview's height a second time on top of the
     * resize Android has already done, and the webview collapses to a sliver:
     * the composer stranded at the top of the screen and the system's white
     * window showing underneath it. That is exactly the reported bug. One
     * resize, done by the OS.
     */
    Keyboard: {},

    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },

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
