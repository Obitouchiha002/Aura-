import React, { useState, useEffect } from 'react';
import { Avatar } from './Avatar';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import {
  X, LogOut, ShieldAlert, User, AlertCircle, MessageSquareHeart, Check,
  Sun, Moon, Globe, Music, Volume2, Vibrate, Smartphone, Share2, ChevronRight, Upload,
  Lock, Fingerprint, Timer,
} from 'lucide-react';
import { ReportIssueModal } from './ReportIssueModal';
import { FeedbackModal } from './FeedbackModal';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useAppLock } from '../context/AppLockContext';
import { isCryptoAvailable } from '../utils/appLock';
import { LockSetup } from './LockSetup';
import { VersionRow } from './VersionRow';
import { Diagnostics } from './Diagnostics';
import { AppUpdateRow } from './AppUpdateRow';

interface SettingsProps {
  onClose: () => void;
}

/** A proper switch — the native checkbox this replaces was unstyled and tiny. */
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }> = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="relative w-12 h-11 p-0 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
  >
    <span
      className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 h-7 rounded-full transition-colors border ${
        checked ? 'bg-aura-red border-transparent' : 'bg-surface-2 border-border'
      }`}
    />
    <span
      className={`absolute top-1/2 left-1 -translate-y-1/2 w-5 h-5 rounded-full transition-transform shadow-sm ${
        checked ? 'translate-x-5 bg-on-accent' : 'translate-x-0 bg-text-faint'
      }`}
    />
  </button>
);

/** A titled group of rows. Every setting lives in one of these. */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h3 className="text-[12px] font-medium text-text-muted mb-2 px-1">{title}</h3>
    <div className="bg-surface border border-border rounded-2xl shadow-soft divide-y divide-border overflow-hidden">
      {children}
    </div>
  </section>
);

/** One 44px row: icon, label, optional hint, and a control on the right. */
const Row: React.FC<{
  icon: React.ComponentType<any>;
  label: string;
  hint?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}> = ({ icon: Icon, label, hint, children, onClick, danger }) => {
  const body = (
    <>
      <Icon size={17} strokeWidth={1.7} className={`shrink-0 ${danger ? 'text-aura-red' : 'text-text-muted'}`} />
      <span className="flex flex-col min-w-0 flex-1 text-left">
        <span className={`text-[14.5px] leading-tight ${danger ? 'text-aura-red' : 'text-text-primary'}`}>{label}</span>
        {hint && <span className="text-[12px] text-text-faint leading-tight mt-0.5">{hint}</span>}
      </span>
      {children}
      {onClick && !children && <ChevronRight size={16} className="text-text-faint shrink-0" />}
    </>
  );

  const cls = 'w-full min-h-[52px] px-4 py-2.5 flex items-center gap-3';
  return onClick
    ? <button onClick={onClick} className={`${cls} hover:bg-surface-2 transition-colors`}>{body}</button>
    : <div className={cls}>{body}</div>;
};

const LANGUAGES = [
  { id: 'hinglish', label: 'Hinglish' },
  { id: 'hi', label: 'हिंदी' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
];

const TRACKS = [
  { id: 'none', label: 'None' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'lofi', label: 'Lo-Fi' },
  { id: 'nature', label: 'Nature' },
  { id: 'classical', label: 'Classical' },
  { id: 'focus', label: 'Focus' },
  { id: 'custom', label: 'Custom' },
];

const selectCls =
  'min-h-[38px] bg-surface-2 border border-border rounded-xl pl-3 pr-8 text-[13.5px] text-text-primary focus:outline-none focus:border-aura-red/50 transition-colors';

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { theme, setTheme, language, setLanguage, hapticFeedback, setHapticFeedback, vibration, setVibration, music, setMusic, volume, setVolume, customMusicUrl, setCustomMusicUrl, haptic, hapticsSupported } = useSettings();
  const { logout, isAdmin, user } = useAuth();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [invitesCount, setInvitesCount] = useState(0);
  const [joinedCount, setJoinedCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showLockSetup, setShowLockSetup] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const {
    config: lock, biometricAvailable, biometricStatus,
    disable: disableLock, setAutoLockMinutes,
    enableBiometric, disableBiometric, lockNow,
  } = useAppLock();
  const [bioError, setBioError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchReferralStats = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('referredBy', '==', user.uid));
        const snapshot = await getDocs(q);
        setJoinedCount(snapshot.size);

        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setInvitesCount(userDocSnap.data().invitesSent || 0);
        }
      } catch (err) {
        console.error("Failed to fetch referral stats", err);
      }
    };
    fetchReferralStats();
  }, [user]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCopyLink = async () => {
    const inviteLink = `https://aurashakti.vercel.app/?ref=${user?.uid}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch (err) {
      console.error('Clipboard write failed', err);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    if (user?.uid) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { invitesSent: increment(1) });
        setInvitesCount(prev => prev + 1);
      } catch (err) {
        console.error("Failed to update invites sent count", err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop is its own element so clicks inside the nested Report and
          Feedback modals can't bubble up and dismiss Settings underneath them. */}
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={onClose} />

      {/* Full-height sheet on phones — at 360x800 this much content in a
          centred modal left barely any of it on screen at once. */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="relative bg-bg border-t sm:border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-float h-[92dvh] sm:h-auto sm:max-h-[88dvh] flex flex-col overflow-hidden"
      >
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="flex justify-between items-center px-5 py-4 shrink-0 border-b border-border">
          <h2 className="text-[19px] font-display font-medium tracking-[-0.01em] text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-text-primary rounded-xl hover:bg-surface-2 transition-colors"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-6 flex-1 overflow-y-auto px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] overscroll-contain scrollbar-hide">

          {/* Account */}
          {user && (
            <div className="bg-surface border border-border shadow-soft p-4 rounded-2xl flex items-center gap-4">
              {user.photoURL ? (
                <Avatar src={user.photoURL} name={user.displayName} email={user.email} className="w-12 h-12 border border-border" />
              ) : (
                <div className="w-12 h-12 bg-surface-2 rounded-full flex items-center justify-center text-lg font-semibold text-text-primary border border-border uppercase">
                  {user.displayName?.[0] || user.email?.[0] || <User size={20} />}
                </div>
              )}
              <div className="overflow-hidden flex-1">
                <p className="text-[15px] font-medium text-text-primary truncate">{user.displayName || 'User'}</p>
                <p className="text-[12.5px] text-text-muted truncate">{user.email}</p>
              </div>
            </div>
          )}

          <Section title="Preferences">
            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <span className="flex items-center gap-3 min-w-0">
                {theme === 'light'
                  ? <Sun size={17} strokeWidth={1.7} className="text-text-muted shrink-0" />
                  : <Moon size={17} strokeWidth={1.7} className="text-text-muted shrink-0" />}
                <span className="text-[14.5px] text-text-primary">Appearance</span>
              </span>
              <div className="flex gap-0.5 p-0.5 bg-surface-2 rounded-xl border border-border shrink-0">
                {([{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }] as const).map(t => (
                  <button
                    key={t.id}
                    onClick={() => { haptic('select'); setTheme(t.id); }}
                    aria-pressed={theme === t.id}
                    className={`px-3 h-8 rounded-lg text-[13px] font-medium transition-colors ${
                      theme === t.id ? 'bg-aura-red text-on-accent' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Six languages never fit as a grid without cramping; a select
                keeps the row height honest and the labels native. */}
            <Row icon={Globe} label="Language">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                aria-label="Language"
                className={selectCls}
              >
                {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </Row>
          </Section>

          <Section title="Sound & feedback">
            <Row icon={Music} label="Background music">
              <select
                value={music}
                onChange={(e) => setMusic(e.target.value as any)}
                aria-label="Background music"
                className={selectCls}
              >
                {TRACKS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Row>

            {music === 'custom' && (
              <div className="px-4 py-3">
                <label className="flex items-center gap-3 text-[14px] text-text-primary cursor-pointer">
                  <Upload size={17} strokeWidth={1.7} className="text-text-muted shrink-0" />
                  <span className="flex-1">Upload a track</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            setCustomMusicUrl(event.target.result as string);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="text-[12px] text-text-muted w-[9.5rem] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[12px] file:bg-surface-2 file:text-text-primary file:cursor-pointer"
                  />
                </label>
                {customMusicUrl && (
                  <p className="text-[12px] text-success mt-2 pl-8">Custom track loaded</p>
                )}
              </div>
            )}

            <Row icon={Volume2} label="Volume">
              <div className="flex items-center gap-2.5 shrink-0">
                <input
                  type="range"
                  min="0" max="1" step="0.05"
                  value={volume}
                  aria-label="Music volume"
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="accent-aura-red w-24"
                />
                <span className="text-[12px] text-text-faint font-mono w-9 text-right tabular-nums">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </Row>

            <Row
              icon={Smartphone}
              label="Haptic feedback"
              hint={hapticsSupported
                ? 'A light tick on taps and while typing'
                : 'Not available in this browser'}
            >
              <Toggle
                checked={hapticFeedback && hapticsSupported}
                disabled={!hapticsSupported}
                /* Turning it on fires one, so you feel what you just enabled. */
                onChange={(v) => { setHapticFeedback(v); if (v) haptic('select'); }}
                label="Haptic feedback"
              />
            </Row>
            <Row
              icon={Vibrate}
              label="Vibration"
              hint={hapticsSupported
                ? 'Stronger pattern for replies, alerts and timers'
                : 'Not available in this browser'}
            >
              <Toggle
                checked={vibration && hapticsSupported}
                disabled={!hapticsSupported}
                onChange={(v) => { setVibration(v); if (v) haptic('success'); }}
                label="Vibration"
              />
            </Row>
            {!hapticsSupported && (
              <p className="px-4 py-3 text-[12px] text-text-faint leading-relaxed">
                iOS Safari does not let web apps use the Taptic Engine, so these
                have no effect here. They work on Android.
              </p>
            )}
          </Section>

          <Section title="Share">
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <Share2 size={17} strokeWidth={1.7} className="text-text-muted shrink-0" />
                <span className="text-[14.5px] text-text-primary flex-1">Invite a friend</span>
                <button
                  onClick={handleCopyLink}
                  className={`h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors min-w-[76px] flex items-center justify-center gap-1.5 ${
                    copied ? 'bg-success text-bg' : 'bg-aura-red text-on-accent hover:brightness-110'
                  }`}
                >
                  {copied ? <><Check size={14} /> Copied</> : 'Copy link'}
                </button>
              </div>
              <p className="text-[12px] text-text-faint font-mono truncate pl-8">
                aurashakti.vercel.app/?ref={user?.uid?.substring(0, 6) || 'guest'}
              </p>
              <div className="flex gap-6 pl-8">
                <div>
                  <span className="text-text-faint block text-[11.5px]">Invites</span>
                  <span className="text-text-primary font-semibold text-[15px]">{invitesCount}</span>
                </div>
                <div>
                  <span className="text-text-faint block text-[11.5px]">Joined</span>
                  <span className="text-text-primary font-semibold text-[15px]">{joinedCount}</span>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Security">
            <Row
              icon={Lock}
              label="App lock"
              hint={!isCryptoAvailable()
                ? 'Needs a secure connection (HTTPS)'
                : lock
                ? `On — ${lock.method === 'pin' ? 'PIN' : lock.method === 'passcode' ? 'passcode' : 'pattern'}`
                : 'Off'}
            >
              <Toggle
                disabled={!isCryptoAvailable()}
                checked={!!lock}
                onChange={(v) => {
                  haptic('select');
                  if (v) setShowLockSetup(true);
                  else disableLock();
                }}
                label="App lock"
              />
            </Row>

            {lock && (
              <Row icon={Timer} label="Ask for it" hint="After being away">
                <select
                  value={lock.autoLockMinutes}
                  onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                  aria-label="Auto-lock delay"
                  className={selectCls}
                >
                  <option value={0}>Every time</option>
                  <option value={1}>After 1 min</option>
                  <option value={5}>After 5 min</option>
                  <option value={15}>After 15 min</option>
                  <option value={60}>After 1 hour</option>
                </select>
              </Row>
            )}

            {lock && (
              <Row
                icon={Fingerprint}
                label="Biometric unlock"
                hint={
                  bioError ? bioError
                  : !biometricAvailable
                    // Say which of these it is. "Not set up on this device" was
                    // shown even to people whose sensor was fine and whose app
                    // was simply too old to have the plugin.
                    ? biometricStatus?.available === false
                      ? {
                          'needs-newer-app': 'App ka naya version chahiye',
                          'not-enrolled': 'Phone mein fingerprint ya screen lock set karein',
                          'unsupported': 'Is device par available nahi',
                        }[biometricStatus.reason]
                      : 'Checking…'
                  : lock.biometric ? 'Face or fingerprint, with your code as backup'
                  : biometricStatus?.available && biometricStatus.via === 'device-credential'
                    ? 'Phone ka PIN ya pattern istemal hoga'
                    : 'Use your face or fingerprint'
                }
              >
                <Toggle
                  checked={lock.biometric}
                  disabled={!biometricAvailable}
                  onChange={async (v) => {
                    setBioError(null);
                    if (!v) { disableBiometric(); return; }
                    try {
                      await enableBiometric(user?.email || 'Aura user');
                      haptic('success');
                    } catch (err: any) {
                      haptic('error');
                      setBioError(err?.name === 'NotAllowedError'
                        ? 'Setup was cancelled'
                        : 'Could not set up biometrics here');
                    }
                  }}
                  label="Biometric unlock"
                />
              </Row>
            )}

            {lock && (
              <Row icon={Lock} label="Lock now" onClick={() => { lockNow(); onClose(); }} />
            )}
          </Section>

          <Section title="Support">
            <Row
              icon={MessageSquareHeart}
              label="Share feedback"
              hint="Tell us what is working and what is not"
              onClick={() => setShowFeedbackModal(true)}
            />
            <Row
              icon={AlertCircle}
              label="Report an issue"
              onClick={() => setShowReportModal(true)}
            />
            {isAdmin && (
              <Row
                icon={ShieldAlert}
                label="Admin dashboard"
                onClick={() => { onClose(); window.location.hash = 'admin'; }}
              />
            )}
          </Section>

          <Section title="Account">
            <AppUpdateRow Row={Row} />

            <VersionRow Row={Row} />

            <Row
              icon={ShieldAlert}
              label="Diagnostics"
              hint="Kya kaam kar raha hai, kya nahi"
              onClick={() => setShowDiagnostics(true)}
            />

            <Row
              icon={LogOut}
              label="Log out"
              danger
              onClick={async () => {
                try {
                  await logout();
                } catch (err) {
                  console.error('Logout failed', err);
                } finally {
                  onClose();
                }
              }}
            />
          </Section>
        </div>
      </motion.div>

      <AnimatePresence>
        {showLockSetup && <LockSetup onClose={() => setShowLockSetup(false)} />}
      </AnimatePresence>
      {showDiagnostics && <Diagnostics onClose={() => setShowDiagnostics(false)} />}
      <ReportIssueModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />
    </div>
  );
};
