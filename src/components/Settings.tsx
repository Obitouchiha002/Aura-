import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { X, LogOut, ShieldAlert, User, AlertCircle, MessageSquareHeart, Check } from 'lucide-react';
import { ReportIssueModal } from './ReportIssueModal';
import { FeedbackModal } from './FeedbackModal';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsProps {
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { language, setLanguage, hapticFeedback, setHapticFeedback, vibration, setVibration, music, setMusic, volume, setVolume, customMusicUrl, setCustomMusicUrl } = useSettings();
  const { logout, isAdmin, user } = useAuth();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [invitesCount, setInvitesCount] = useState(0);
  const [joinedCount, setJoinedCount] = useState(0);
  const [copied, setCopied] = useState(false);

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

  const handleCopyLink = async () => {
    const inviteLink = `http://aurashakti.vercel.app/?ref=${user?.uid}`;
    navigator.clipboard.writeText(inviteLink);
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
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white">Settings</h2>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 scrollbar-hide">
          {user && (
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center space-x-4">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-12 h-12 rounded-full border border-white/20" />
              ) : (
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-lg font-bold text-white border border-white/20">
                  {user.displayName?.[0] || user.email?.[0]?.toUpperCase() || <User size={20} />}
                </div>
              )}
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-bold text-white truncate">{user.displayName || 'User'}</p>
                <p className="text-xs text-white/50 truncate">{user.email}</p>
              </div>
            </div>
          )}

          {isAdmin && (
            <button
              onClick={() => {
                onClose();
                window.location.hash = 'admin';
              }}
              className="w-full flex items-center justify-center space-x-2 bg-aura-red/10 hover:bg-aura-red/20 text-aura-red border border-aura-red/20 p-3 rounded-xl transition-colors"
            >
              <ShieldAlert size={18} />
              <span className="font-medium">Admin Dashboard</span>
            </button>
          )}

           <div>
            <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">Language</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'hinglish', label: 'Hinglish' },
                { id: 'hi', label: 'Hindi' },
                { id: 'en', label: 'English' },
                { id: 'es', label: 'Spanish' },
                { id: 'fr', label: 'French' },
                { id: 'de', label: 'German' }
              ].map(l => (
                <button
                  key={l.id}
                  onClick={() => setLanguage(l.id as any)}
                  className={`p-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    language === l.id 
                      ? 'bg-aura-red text-black shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-white/5'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-white">Haptic Feedback</span>
            <input type="checkbox" checked={hapticFeedback} onChange={(e) => setHapticFeedback(e.target.checked)} className="accent-aura-red" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-white">Vibration</span>
            <input type="checkbox" checked={vibration} onChange={(e) => setVibration(e.target.checked)} className="accent-aura-red" />
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">Background Music</label>
            <div className="relative">
              <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide snap-x mask-linear-fade">
                {[
                  { id: 'none', label: 'None' },
                  { id: 'ambient', label: 'Ambient' },
                  { id: 'lofi', label: 'Lo-Fi' },
                  { id: 'nature', label: 'Nature' },
                  { id: 'classical', label: 'Classical' },
                  { id: 'focus', label: 'Focus' },
                  { id: 'custom', label: 'Custom' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMusic(m.id as any)}
                    className={`flex-shrink-0 p-2 min-w-[80px] rounded-xl text-xs font-bold uppercase tracking-wider transition-all snap-center ${
                      music === m.id 
                        ? 'bg-aura-red text-black shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                        : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-white/5'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="absolute top-0 right-0 bottom-2 w-8 bg-gradient-to-l from-[#0a0a0a] to-transparent pointer-events-none" />
            </div>
          </div>

          {music === 'custom' && (
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider">Upload Custom Music</label>
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
                className="w-full mt-1 text-xs text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:bg-aura-red file:text-black hover:file:bg-aura-red/80"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-white">Music Volume</span>
            <input 
              type="range" 
              min="0" max="1" step="0.05" 
              value={volume} 
              onChange={(e) => setVolume(parseFloat(e.target.value))} 
              className="accent-aura-red w-24" 
            />
          </div>

          <div className="pt-4 mt-4 border-t border-white/10 space-y-2">
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-3 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-aura-red/5 to-transparent pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <h3 className="text-sm font-bold text-white mb-1">Invite & Share</h3>
                <p className="text-xs text-white/50 mb-3">Share Aura with friends and earn rewards.</p>
                <div className="flex gap-2">
                  <div className="bg-black/50 border border-white/10 px-3 py-2 rounded-lg flex-1 overflow-hidden flex items-center justify-center">
                    <p className="text-[10px] text-white/70 truncate font-mono tracking-tighter">aurashakti.vercel.app/?ref={user?.uid?.substring(0, 6) || 'guest'}</p>
                  </div>
                  <button 
                    onClick={handleCopyLink}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all min-w-[70px] flex items-center justify-center gap-1 ${
                      copied 
                        ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]' 
                        : 'bg-aura-red text-black hover:bg-white'
                    }`}
                  >
                    <AnimatePresence mode="wait">
                      {copied ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="flex items-center gap-1"
                        >
                          <Check size={14} />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="copy"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          Copy
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
                <div className="flex gap-4 mt-3 text-xs">
                  <div>
                    <span className="text-white/40 block uppercase tracking-widest text-[9px]">Invites</span>
                    <span className="text-aura-red font-bold">{invitesCount}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block uppercase tracking-widest text-[9px]">Joined</span>
                    <span className="text-white font-bold">{joinedCount}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowFeedbackModal(true)}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-aura-red/10 to-transparent hover:from-aura-red/20 text-white p-3 rounded-xl transition-all border border-aura-red/20 shadow-[inset_0_0_10px_rgba(239,68,68,0.05)] text-left"
            >
              <MessageSquareHeart size={18} className="text-aura-red" />
              <span className="font-medium flex-1 text-center pr-5">Share Feedback</span>
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReportModal(true)}
                className="flex-1 flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 text-white p-3 rounded-xl transition-colors"
              >
                <AlertCircle size={18} />
                <span className="font-medium text-sm">Report Issue</span>
              </button>
              <button
                onClick={async () => {
                  await logout();
                  onClose();
                }}
                className="flex-1 flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 text-white p-3 rounded-xl transition-colors"
              >
                <LogOut size={18} />
                <span className="font-medium text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
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
