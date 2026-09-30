import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { storageReport } from '../firebase';
import { LogIn, Loader2, Mail, Lock, User as UserIcon, ArrowLeft, Check } from 'lucide-react';

/** Which form is on screen. Sign-in is the one people come back to. */
type Mode = 'signin' | 'signup' | 'reset';

/**
 * Turns an auth failure into something worth reading.
 *
 * Firebase folds a wrong password and an unknown address into the same code,
 * `auth/invalid-credential`, so that the form cannot be used to find out which
 * addresses have accounts. That is worth keeping, so the message names both
 * possibilities rather than guessing at one of them.
 */
function describe(e: any): string {
  const code = String(e?.code || '');

  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled. Please try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups and try again.';
    case 'auth/unauthorized-domain':
      return `This site (${window.location.hostname}) is not on the app's authorized sign-in domains, so Google blocked the popup. Add it in Firebase Console → Authentication → Settings → Authorized domains.`;
    case 'auth/network-request-failed':
      return 'Could not reach the sign-in service. Please check your connection and try again.';

    case 'auth/invalid-email':
      return 'That does not look like an email address.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/weak-password':
      return 'Please choose a password of at least six characters.';
    case 'auth/email-already-in-use':
      return 'There is already an account with that email. Sign in instead, or reset the password.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password do not match an account. Check the password, or create an account.';
    case 'auth/too-many-requests':
      return 'Too many attempts from this device. Wait a few minutes and try again.';
    case 'auth/operation-not-allowed':
      return 'Email sign-in is not switched on for this app yet. Enable Email/Password in Firebase Console → Authentication → Sign-in method.';
    case 'auth/user-disabled':
      return 'That account has been disabled.';
  }

  // Storage failures arrive as the browser's own sentence with no code at all.
  // The probe rides along, because whoever reports this is reading a screen
  // rather than a console.
  if (/database|indexeddb|storage|quota/i.test(String(e?.message || ''))) {
    return `Your browser would not let the app store the sign-in. If this is a private window, or site data is blocked or full, try a normal window.  [${storageReport()} · ${String(e?.message || '').slice(0, 80)}]`;
  }

  // The native picker reports a message rather than a code, so showing only the
  // code left every Android failure looking identical and unreportable.
  return `Could not sign in right now. Please try again.${
    code ? ` (${code})` : e?.message ? ` — ${String(e.message).slice(0, 160)}` : ''
  }`;
}

const FIELD =
  'w-full bg-surface border border-border focus:border-border-strong rounded-xl pl-11 pr-4 py-3.5 ' +
  'text-[15px] text-text-primary placeholder:text-text-faint outline-none transition-colors';

const ICON = 'w-4 h-4 text-text-faint absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none';

export const Login: React.FC = () => {
  const { login, emailLogin, emailSignUp, sendReset } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const go = (next: Mode) => {
    setMode(next);
    setError(null);
    setSent(false);
    setPassword('');
  };

  const handleGoogle = async () => {
    if (busy) return;
    setError(null);
    setBusy('google');
    try {
      await login();
    } catch (e: any) {
      setError(describe(e));
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    setError(null);
    setBusy('email');
    try {
      if (mode === 'reset') {
        await sendReset(email);
        // Said the same way whether or not that address has an account —
        // confirming it would turn this form into a way to enumerate them.
        setSent(true);
      } else if (mode === 'signup') {
        await emailSignUp(name, email, password);
      } else {
        await emailLogin(email, password);
      }
    } catch (e: any) {
      setError(describe(e));
    } finally {
      setBusy(null);
    }
  };

  const heading = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Welcome';
  const subheading =
    mode === 'signup' ? 'A name, an email, a password' :
    mode === 'reset' ? 'We will email you a link' :
    'Identify yourself to enter';

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
        className="relative z-10 max-w-sm w-full flex flex-col items-center space-y-8 py-10"
      >
        <div className="text-center space-y-4">
          {/* The app's own mark, the same one the launcher and the installed
              web app use. This was a third, unrelated logo. */}
          <img
            src="/icon-192.png"
            alt=""
            aria-hidden="true"
            className="w-16 h-16 mx-auto rounded-2xl border border-border object-cover shadow-lg"
          />
          <div className="space-y-2">
            <h1 className="text-4xl font-serif italic text-aura-red">{heading}</h1>
            <p className="text-text-muted text-[11px] tracking-[0.25em] uppercase font-mono">
              {subheading}
            </p>
          </div>
        </div>

        <div className="w-full flex flex-col items-center space-y-4">
          {/* Google keeps the top of the form — it is still the fastest route
              in. It is simply no longer the only one, which used to strand
              anyone whose Google account was not the one they wanted to use. */}
          {mode !== 'reset' && (
            <>
              <motion.button
                whileHover={{ scale: busy ? 1 : 1.02 }}
                whileTap={{ scale: busy ? 1 : 0.98 }}
                onClick={handleGoogle}
                disabled={!!busy}
                className="w-full flex items-center justify-center gap-3 bg-surface hover:bg-surface-2 border border-border hover:border-border-strong px-8 py-4 rounded-2xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                {busy === 'google'
                  ? <Loader2 className="w-5 h-5 text-aura-red animate-spin" />
                  : <LogIn className="w-5 h-5 text-aura-red" />}
                <span className="font-medium tracking-wide text-text-primary">
                  {busy === 'google' ? 'Signing in…' : 'Continue with Google'}
                </span>
              </motion.button>

              <div className="w-full flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-text-faint">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={handleEmail} className="w-full space-y-3">
            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative overflow-hidden"
                >
                  <UserIcon className={ICON} />
                  <input
                    className={FIELD}
                    type="text"
                    name="name"
                    autoComplete="name"
                    placeholder="Your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Mail className={ICON} />
              <input
                className={FIELD}
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            {mode !== 'reset' && (
              <div className="relative">
                <Lock className={ICON} />
                <input
                  className={FIELD}
                  type="password"
                  name="password"
                  // Tells a password manager which password to offer, and which
                  // to offer to save. Without it a new one is never saved.
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'signup' ? 'Choose a password' : 'Password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            )}

            <motion.button
              whileHover={{ scale: busy ? 1 : 1.02 }}
              whileTap={{ scale: busy ? 1 : 0.98 }}
              type="submit"
              disabled={!!busy}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-b from-accent to-accent-dim text-on-accent px-8 py-4 rounded-2xl font-semibold tracking-wide transition-transform disabled:opacity-60 disabled:cursor-not-allowed shadow-float"
            >
              {busy === 'email' && <Loader2 className="w-5 h-5 animate-spin" />}
              {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
            </motion.button>
          </form>

          {sent && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              role="status"
              className="text-xs text-text-muted text-left leading-relaxed px-2 flex items-start gap-2"
            >
              <Check className="w-4 h-4 text-aura-red shrink-0 mt-px" />
              If there is an account for that address, a reset link is on its way. Look in spam too.
            </motion.p>
          )}

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

          <div className="pt-1 text-center text-xs text-text-muted space-y-2">
            {mode === 'signin' && (
              <>
                <p>
                  <button
                    type="button"
                    onClick={() => go('reset')}
                    className="hover:text-text-primary transition-colors underline decoration-border"
                  >
                    Forgot your password?
                  </button>
                </p>
                <p>
                  New here?{' '}
                  <button type="button" onClick={() => go('signup')} className="text-aura-red hover:underline font-medium">
                    Create an account
                  </button>
                </p>
              </>
            )}

            {mode === 'signup' && (
              <p>
                Already have an account?{' '}
                <button type="button" onClick={() => go('signin')} className="text-aura-red hover:underline font-medium">
                  Sign in
                </button>
              </p>
            )}

            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => go('signin')}
                className="inline-flex items-center gap-1.5 hover:text-text-primary transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </button>
            )}
          </div>
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
