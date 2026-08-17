import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { LogIn, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (isSigningIn) return;
    setError(null);
    setIsSigningIn(true);
    try {
      await login();
    } catch (e: any) {
      // Popup blocked / closed / domain not allowed — say which, instead of
      // blaming the connection for every failure.
      const code = e?.code as string | undefined;
      setError(
        code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
          ? 'Sign-in was cancelled. Please try again.'
          : code === 'auth/popup-blocked'
          ? 'Your browser blocked the sign-in popup. Allow popups and try again.'
          : code === 'auth/unauthorized-domain'
          ? `This site (${window.location.hostname}) is not on the app's authorized sign-in domains, so Google blocked the popup. Add it in Firebase Console → Authentication → Settings → Authorized domains.`
          : code === 'auth/network-request-failed'
          ? 'Could not reach the sign-in service. Please check your connection and try again.'
          // The native picker reports a message rather than a Firebase code, so
          // showing only the code left every Android failure looking identical
          // and unreportable. Whatever detail exists is surfaced.
          : `Could not sign in right now. Please try again.${
              code ? ` (${code})` : e?.message ? ` — ${String(e.message).slice(0, 160)}` : ''
            }`
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-bg text-text-primary flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,var(--accent-wash)_0%,transparent_65%)] pointer-events-none" />
      {/* A gradient, not a blurred disc. blur(140px) over 28rem is a large
          convolution the WebView runs before the first screen of the app is
          even on glass. */}
      <div
        className="absolute -top-40 -right-32 w-[28rem] h-[28rem] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(229,72,77,.10) 0%, transparent 66%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 max-w-sm w-full flex flex-col items-center space-y-10"
      >
        <div className="text-center space-y-4">
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            className="w-16 h-16 mx-auto rounded-2xl border border-border object-cover shadow-lg"
          />
          <div className="space-y-2">
            <h1 className="text-4xl font-serif italic text-aura-red">Welcome</h1>
            <p className="text-text-muted text-[11px] tracking-[0.25em] uppercase font-mono">
              Identify yourself to enter
            </p>
          </div>
        </div>

        <div className="w-full flex flex-col items-center space-y-3">
          <motion.button
            whileHover={{ scale: isSigningIn ? 1 : 1.03 }}
            whileTap={{ scale: isSigningIn ? 1 : 0.97 }}
            onClick={handleLogin}
            disabled={isSigningIn}
            className="w-full flex items-center justify-center gap-3 bg-surface hover:bg-surface-2 border border-border hover:border-border-strong px-8 py-4 rounded-2xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {isSigningIn ? (
              <Loader2 className="w-5 h-5 text-aura-red animate-spin" />
            ) : (
              <LogIn className="w-5 h-5 text-aura-red" />
            )}
            <span className="font-medium tracking-wide text-text-primary">
              {isSigningIn ? 'Signing in…' : 'Sign in with Google'}
            </span>
          </motion.button>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="text-xs text-aura-red text-center leading-relaxed px-2"
            >
              {error}
            </motion.p>
          )}
        </div>
      </motion.div>

      <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20 px-4">
        <a
          href="mailto:vk1234888i@gmail.com?subject=Aura%20App%20Issue"
          className="text-[10px] text-text-faint hover:text-text-muted transition-colors"
        >
          Developer: Vansh Kashyap | Report Issue
        </a>
      </div>
    </div>
  );
};
