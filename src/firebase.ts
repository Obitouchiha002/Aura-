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
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

/** True inside the Android build, false in any browser. */
const isNative = Capacitor.isNativePlatform();

/**
 * Whether a failed popup is worth retrying as a full-page redirect.
 *
 * A popup needs a window it is allowed to open and storage it can reach across
 * two origins. A redirect needs neither, so most of what stops a popup does not
 * stop it — but it costs the person the page they are on, so it is only used
 * where the popup had no chance rather than after every failure.
 *
 * Closing the window counts as an answer, not a failure: sending someone away
 * from the page because they changed their mind is worse than doing nothing.
 */
function worthRedirecting(error: any): boolean {
  const code = String(error?.code || '');

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return false;
  }

  if (
    code === 'auth/popup-blocked' ||
    code === 'auth/web-storage-unsupported' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/internal-error'
  ) {
    return true;
  }

  // The storage failures arrive with no Firebase code at all — just the
  // browser's own sentence, which is why they used to surface as a bare
  // "try again" with nothing to act on.
  return /database|indexeddb|storage|quota/i.test(String(error?.message || ''));
}

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

    if (!isNative && worthRedirecting(error)) {
      // Leaves this page for Google's and comes back signed in, which is the
      // one route left when the popup could not be opened or could not reach
      // its storage. Nothing after this line runs.
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
