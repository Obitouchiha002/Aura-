import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  auth, db, loginWithGoogle, logout as firebaseLogout,
  completeRedirectSignIn, clearRedirectAttempt,
  signInWithEmail, signUpWithEmail, resetPassword,
} from '../firebase';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: () => Promise<void>;
  /** Email and password, for accounts that are not Google ones. */
  emailLogin: (email: string, password: string) => Promise<void>;
  emailSignUp: (name: string, email: string, password: string) => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAndIncrementMessageLimit: () => Promise<{
    allowed: boolean;
    isFreeTier: boolean;
    justReachedLimit: boolean;
    /** Set when an admin has stopped this account. */
    blocked?: { reason?: string; permanent?: boolean };
  }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * What each plan gets in a day.
 *
 * Past the limit nobody is cut off — they continue on the slower model. So
 * these are about who waits, not who is refused. `null` means no ceiling.
 *
 * An admin can override any single account from the user directory, which
 * takes precedence over the plan.
 */
const PLAN_LIMITS: Record<string, number | null> = {
  free: 25,
  plus: 200,
  premium: null,     // unlimited
};

const DAILY_MESSAGE_LIMIT = PLAN_LIMITS.free ?? 25;

/* ─────────────── LOCAL TESTING ONLY — REMOVE BEFORE GOING LIVE ───────────────
 * Skips the Google sign-in screen so the app can be used on localhost without
 * adding `localhost` to the Firebase authorized-domains list.
 *
 * Two locks, both must be open for this to run:
 *   1. import.meta.env.DEV  — false in every production build, so `npm run
 *      build` output can never bypass auth no matter what the env says.
 *   2. VITE_BYPASS_AUTH=true in .env.local (untracked; .gitignore covers .env*).
 *
 * To turn it off: set VITE_BYPASS_AUTH=false in .env.local, or delete the file.
 * To remove it for good: delete this block and the `if (BYPASS_AUTH)` branch
 * inside the effect below.
 * ─────────────────────────────────────────────────────────────────────────── */
// @ts-ignore — import.meta.env is provided by Vite
const BYPASS_AUTH = import.meta.env?.DEV === true && import.meta.env?.VITE_BYPASS_AUTH === 'true';

const DEV_USER = {
  uid: 'local-dev-user',
  email: 'dev@localhost',
  displayName: 'Local Tester',
  photoURL: null,
  emailVerified: true,
  isAnonymous: false,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * The name given at sign-up, held until the first document write uses it.
   *
   * createUserWithEmailAndPassword fires the auth state change immediately,
   * with a user that has no name on it yet, and setting the profile is a second
   * round trip that races it. Whichever arrives first, the document gets the
   * name — which matters because the rules reject a null one.
   */
  const pendingNameRef = useRef<string | null>(null);

  useEffect(() => {
    // LOCAL TESTING ONLY — see the BYPASS_AUTH note above.
    if (BYPASS_AUTH) {
      console.warn(
        '[dev] Auth bypass is ON — signed in as a fake local user. ' +
        'Firestore reads/writes will be denied (no real token), so chat history, ' +
        'simulator progress and admin data will not load or save. ' +
        'This never runs in a production build.'
      );
      setUser(DEV_USER as unknown as User);
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    let sessionInterval: NodeJS.Timeout;
    let currentSessionId: string | null = null;

    /**
     * A sign-in that finished by redirect lands back here, not in the popup
     * handler that started it. Asking for the result is what makes a redirect
     * that failed say why, rather than returning the person to the login screen
     * with no reason given. The user itself still arrives below.
     */
    completeRedirectSignIn();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // A session exists, so the one-redirect-per-visit guard has done its
        // job and a future sign-in in this tab may use one again.
        clearRedirectAttempt();
        
        try {
          // Check or create user profile in Firestore
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          let role = 'user';
          if (currentUser.email === 'vk1234888i@gmail.com') {
            role = 'admin';
          }

          const today = new Date().toISOString().split('T')[0];

          /**
           * A name or a picture the account does not have is left out, not
           * written as null.
           *
           * The rules accept these two as a string or not at all:
           *
           *     (!('displayName' in data) || data.displayName is string)
           *
           * A Google account arrives carrying both. An email sign-up carries
           * neither, so writing `displayName: null` fails that check — and
           * because it fails the whole document, the account ends up with no
           * record. No record means checkAndIncrementMessageLimit finds nothing
           * and refuses every send, so the person signs in successfully and
           * then cannot use the app at all.
           */
          const displayName = currentUser.displayName || pendingNameRef.current || null;
          const optional: Record<string, string> = {};
          if (displayName) optional.displayName = displayName;
          if (currentUser.photoURL) optional.photoURL = currentUser.photoURL;

          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              ...optional,
              role: role,
              createdAt: serverTimestamp(),
              lastLoginAt: serverTimestamp(),
              dailyMessageCount: 0,
              lastMessageDate: today
            });
            pendingNameRef.current = null;
          } else {
            const stored = userSnap.data();
            // A name that turned up after the document did — the profile update
            // on an email sign-up lands a moment after the account exists, and
            // a Google account may gain a picture later. Only ever filled in,
            // never overwritten: the directory may have been edited by hand.
            const late: Record<string, string> = {};
            if (!stored.displayName && displayName) late.displayName = displayName;
            if (!stored.photoURL && currentUser.photoURL) late.photoURL = currentUser.photoURL;

            await setDoc(userRef, {
              lastLoginAt: serverTimestamp(),
              ...late,
            }, { merge: true });

            role = stored.role;
          }
          
          setIsAdmin(role === 'admin');

          // Start session tracking
          currentSessionId = `session_${Date.now()}_${currentUser.uid}`;
          const sessionRef = doc(db, 'sessions', currentSessionId);
          const startTime = new Date();
          
          await setDoc(sessionRef, {
            sessionId: currentSessionId,
            uid: currentUser.uid,
            email: currentUser.email,
            startTime: serverTimestamp(),
            endTime: serverTimestamp(),
            durationSeconds: 0
          });

          sessionInterval = setInterval(async () => {
            if (currentSessionId) {
              try {
                const duration = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
                await setDoc(doc(db, 'sessions', currentSessionId), {
                  endTime: serverTimestamp(),
                  durationSeconds: duration
                }, { merge: true });
              } catch (e) {
                console.error("Failed to update session:", e);
              }
            }
          }, 30000); // Update every 30 seconds
        } catch (error) {
          console.error("Firestore initialization error during auth:", error);
          // Don't crash auth state if firestore fails initially
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        if (sessionInterval) clearInterval(sessionInterval);
        currentSessionId = null;
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (sessionInterval) clearInterval(sessionInterval);
    };
  }, []);

  const login = async () => {
    await loginWithGoogle();
  };

  const emailLogin = async (email: string, password: string) => {
    await signInWithEmail(email, password);
  };

  const emailSignUp = async (name: string, email: string, password: string) => {
    // Set before the account exists, so the listener cannot beat it there.
    pendingNameRef.current = name.trim() || null;
    try {
      await signUpWithEmail(name, email, password);
    } catch (e) {
      pendingNameRef.current = null;
      throw e;
    }
  };

  const sendReset = async (email: string) => {
    await resetPassword(email);
  };

  const logout = async () => {
    // With the bypass on there is no real session to end, and signing out
    // would just drop us back to a login screen that cannot succeed.
    if (BYPASS_AUTH) return;
    await firebaseLogout();
  };

  /**
   * Decides whether this account may send, and on which tier.
   *
   * Three things can stop or shape a send: an admin block, a per-account daily
   * limit, and the default limit. The block is checked first — a blocked
   * account should not have its counter advanced or its quota consumed.
   */
  const checkAndIncrementMessageLimit = async (): Promise<{
    allowed: boolean; isFreeTier: boolean; justReachedLimit: boolean;
    blocked?: { reason?: string; permanent?: boolean };
  }> => {
    if (!user) return { allowed: false, isFreeTier: false, justReachedLimit: false };
    if (isAdmin) return { allowed: true, isFreeTier: false, justReachedLimit: false };

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return { allowed: false, isFreeTier: false, justReachedLimit: false };
    
    const data = userSnap.data();

    if (data.blocked || data.blockedPermanently) {
      return {
        allowed: false, isFreeTier: false, justReachedLimit: false,
        blocked: { reason: data.blockedReason, permanent: !!data.blockedPermanently },
      };
    }

    const today = new Date().toISOString().split('T')[0];
    
    let currentCount = data.dailyMessageCount || 0;
    let lastDate = data.lastMessageDate || '';

    if (lastDate !== today) {
      // Reset for a new day
      currentCount = 0;
      lastDate = today;
    }

    let isFreeTier = false;
    let justReachedLimit = false;

    // Precedence: an override set on this one account, then their plan, then
    // the default. A premium plan has no ceiling at all.
    const planLimit = PLAN_LIMITS[data.plan as string] !== undefined
      ? PLAN_LIMITS[data.plan as string]
      : DAILY_MESSAGE_LIMIT;

    const limit = typeof data.dailyLimit === 'number' && data.dailyLimit >= 0
      ? data.dailyLimit
      : planLimit;

    if (limit !== null && currentCount >= limit) {
      isFreeTier = true;
      if (currentCount === limit) {
        justReachedLimit = true;
      }
    }

    // Increment
    await setDoc(userRef, {
      dailyMessageCount: currentCount + 1,
      lastMessageDate: today
    }, { merge: true });

    return { allowed: true, isFreeTier, justReachedLimit };
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, emailLogin, emailSignUp, sendReset, logout, checkAndIncrementMessageLimit }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
