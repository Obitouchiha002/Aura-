import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut,
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

/** True inside the Android build, false in any browser. */
const isNative = Capacitor.isNativePlatform();

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
