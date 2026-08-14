import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout as firebaseLogout } from '../firebase';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  checkAndIncrementMessageLimit: () => Promise<{ allowed: boolean; isFreeTier: boolean; justReachedLimit: boolean }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DAILY_MESSAGE_LIMIT = 50;

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

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        try {
          // Check or create user profile in Firestore
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          let role = 'user';
          if (currentUser.email === 'vk1234888i@gmail.com') {
            role = 'admin';
          }

          const today = new Date().toISOString().split('T')[0];

          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              role: role,
              createdAt: serverTimestamp(),
              lastLoginAt: serverTimestamp(),
              dailyMessageCount: 0,
              lastMessageDate: today
            });
          } else {
            // Update last login
            await setDoc(userRef, {
              lastLoginAt: serverTimestamp()
            }, { merge: true });
            
            role = userSnap.data().role;
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

  const logout = async () => {
    // With the bypass on there is no real session to end, and signing out
    // would just drop us back to a login screen that cannot succeed.
    if (BYPASS_AUTH) return;
    await firebaseLogout();
  };

  const checkAndIncrementMessageLimit = async (): Promise<{ allowed: boolean; isFreeTier: boolean; justReachedLimit: boolean }> => {
    if (!user) return { allowed: false, isFreeTier: false, justReachedLimit: false };
    if (isAdmin) return { allowed: true, isFreeTier: false, justReachedLimit: false };

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return { allowed: false, isFreeTier: false, justReachedLimit: false };
    
    const data = userSnap.data();
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

    if (currentCount >= DAILY_MESSAGE_LIMIT) {
      isFreeTier = true;
      if (currentCount === DAILY_MESSAGE_LIMIT) {
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
    <AuthContext.Provider value={{ user, isAdmin, loading, login, logout, checkAndIncrementMessageLimit }}>
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
