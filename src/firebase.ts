import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  initializeAuth,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  signOut,
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

/**
 * Auth, with more than one place to keep the session.
 *
 * `getAuth` gives the session IndexedDB and nothing else. When IndexedDB
 * cannot be opened the sign-in fails before it reaches Google, with the
 * browser's own words — "Database is closing" — and no Firebase code attached,
 * so the app could only report that something went wrong and ask the person to
 * try again. Trying again does not help: the database is not going to open on
 * the second attempt either.
 *
 * A database that will not open is ordinary. It happens in a private window,
 * with site data blocked or cleared, while another tab is upgrading the same
 * database, and on a first visit to a new origin — which is exactly what moving
 * the app to its own domain made everybody do.
 *
 * So the persistence is a list. Firebase walks it in order and keeps the first
 * one that works: IndexedDB if it opens, localStorage if it does not, and
 * memory as the last resort — that one does not survive a reload, but being
 * signed in for this visit is far better than not being able to sign in.
 *
 * `popupRedirectResolver` has to be named here. `getAuth` wires it up on its
 * own; `initializeAuth` does not, and without it signInWithPopup throws before
 * it opens anything.
 */
function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Already initialized — a hot reload re-ran this module. Take what is there
    // rather than throwing on the way up and taking the whole app with it.
    return getAuth(app);
  }
}

export const auth = createAuth();

/**
 * What this browser actually allows, said once on launch.
 *
 * Sign-in has now failed here in three different ways, each reported as a
 * sentence with no way to tell which of storage, popups or the redirect was
 * refused — so every fix has been a guess. This prints the answer. One console
 * screenshot names the layer that is broken.
 *
 * Console only, and every probe is wrapped: this runs in the case where storage
 * throws on being touched, which is the case it exists to describe.
 */
(() => {
  const probe = (label: string, fn: () => void) => {
    try { fn(); return `${label}=ok`; } catch (e: any) { return `${label}=BLOCKED(${e?.name || 'error'})`; }
  };

  const lines = [
    probe('localStorage', () => {
      localStorage.setItem('aura_probe', '1');
      localStorage.removeItem('aura_probe');
    }),
    probe('sessionStorage', () => {
      sessionStorage.setItem('aura_probe', '1');
      sessionStorage.removeItem('aura_probe');
    }),
    probe('indexedDB', () => {
      if (!window.indexedDB) throw new Error('absent');
    }),
    `cookies=${navigator.cookieEnabled ? 'ok' : 'BLOCKED'}`,
    `origin=${window.location.origin}`,
    `authDomain=${(firebaseConfig as any).authDomain}`,
  ];

  console.log('[aura/auth]', lines.join('  '));
})();
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

/** True inside the Android build, false in any browser. */
const isNative = Capacitor.isNativePlatform();

/**
 * Whether a failed popup is worth retrying as a full-page redirect.
 *
 * Only when the popup itself was the problem — a window the browser would not
 * let us open, or an environment that has no popups to open. A redirect does
 * not need a second window, so those it genuinely fixes.
 *
 * It does NOT cover a storage failure, although it used to. A redirect has to
 * write down where it came from before it leaves and read it back on the way
 * in; if storage is refusing us, it cannot do either, so it returns to a page
 * that has no session, shows the login screen, and the person clicks again.
 * That is the loop — Google asking for an account over and over, each attempt
 * looking like the first. An error message they can act on is worth more than a
 * retry that cannot succeed.
 *
 * Closing the window counts as an answer, not a failure: sending someone away
 * from the page because they changed their mind is worse than doing nothing.
 */
function worthRedirecting(error: any): boolean {
  const code = String(error?.code || '');
  return code === 'auth/popup-blocked'
      || code === 'auth/operation-not-supported-in-this-environment';
}

/**
 * One redirect per visit, whatever happens to it.
 *
 * A redirect that comes back without a session leaves the login screen up, and
 * the obvious thing to do is click the button again — so the guard cannot live
 * in the click handler. sessionStorage is the right scope: it is forgotten when
 * the tab closes, so a real retry later is still allowed, and it survives the
 * navigation to Google and back, which is the only thing it has to survive.
 *
 * Wrapped, because a browser that is refusing storage is exactly the case this
 * exists for. If it cannot be read, no redirect is attempted at all — the
 * conservative answer, since a redirect needs that same storage to work.
 */
const REDIRECT_TRIED = 'aura_auth_redirect_tried';

function claimRedirectAttempt(): boolean {
  try {
    if (sessionStorage.getItem(REDIRECT_TRIED)) return false;
    sessionStorage.setItem(REDIRECT_TRIED, '1');
    return true;
  } catch {
    return false;
  }
}

/** Called once a session really exists, so a later sign-in may redirect again. */
export const clearRedirectAttempt = () => {
  try { sessionStorage.removeItem(REDIRECT_TRIED); } catch {}
};

/**
 * Picks up a sign-in that finished by coming back to the page.
 *
 * Called once on launch. The user also arrives through onAuthStateChanged, so
 * this is really here to make a failed redirect say so in the console instead
 * of leaving the login screen up with no explanation.
 */
export const completeRedirectSignIn = async () => {
  if (isNative) return null;
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch (error) {
    console.error('Redirect sign-in did not complete', error);
    return null;
  }
};

/**
 * Sign in with Google.
 *
 * Two routes, because one does not work in both places:
 *
 *  - In a browser, `signInWithPopup` opens Google's own window and Firebase
 *    handles the whole exchange.
 *  - Inside the Android build the page is served from https://localhost in a
 *    webview, where that popup is unreliable and Google increasingly refuses
 *    to render its sign-in page at all. So the native account picker runs
 *    instead, and the ID token it returns is exchanged for the same Firebase
 *    credential — the rest of the app cannot tell the difference.
 *
 * The plugin is imported lazily so the browser bundle never pulls it in.
 */
export const loginWithGoogle = async () => {
  try {
    if (isNative) {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const result = await FirebaseAuthentication.signInWithGoogle();

      const idToken = result.credential?.idToken;
      if (!idToken) {
        throw new Error('Google did not return an ID token.');
      }

      // The native layer has its own Firebase session; this gives the JS SDK
      // one too, so Firestore rules and the rest of the app see a signed-in
      // user exactly as they do on the web.
      const credential = GoogleAuthProvider.credential(idToken);
      const signed = await signInWithCredential(auth, credential);
      return signed.user;
    }

    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);

    if (!isNative && worthRedirecting(error) && claimRedirectAttempt()) {
      // Leaves this page for Google's and comes back signed in, which is the
      // one route left when the popup could not be opened at all. Nothing
      // after this line runs.
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    throw error;
  }
};

export const logout = async () => {
  try {
    if (isNative) {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      // Clear the native session too, or the next sign-in silently reuses the
      // same account with no picker shown.
      await FirebaseAuthentication.signOut().catch(() => {});
    }
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
