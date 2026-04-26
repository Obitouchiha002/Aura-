import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { X, LogOut, ShieldAlert, User, AlertCircle, MessageSquareHeart } from 'lucide-react';
import { ReportIssueModal } from './ReportIssueModal';
import { FeedbackModal } from './FeedbackModal';

interface SettingsProps {
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { language, setLanguage, hapticFeedback, setHapticFeedback, vibration, setVibration, music, setMusic, volume, setVolume, customMusicUrl, setCustomMusicUrl } = useSettings();
  const { logout, isAdmin, user } = useAuth();
  const [showReportModal, setShowReportModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

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
