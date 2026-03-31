import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { X } from 'lucide-react';

interface SettingsProps {
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { language, setLanguage, hapticFeedback, setHapticFeedback, vibration, setVibration, music, setMusic, volume, setVolume, customMusicUrl, setCustomMusicUrl, userApiKey, setUserApiKey } = useSettings();

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white">Settings</h2>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 scrollbar-hide">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Custom Gemini API Key</label>
            <input
              type="password"
              value={userApiKey || ''}
              onChange={(e) => setUserApiKey(e.target.value)}
              placeholder="Enter your own key to bypass limits"
              className="w-full mt-1 bg-white/5 border border-white/10 p-2 rounded-lg text-white placeholder:text-white/20 text-sm"
            />
            <p className="text-[10px] text-white/40 mt-1 leading-tight">
              Get a free key from <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-aura-red hover:underline">Google AI Studio</a> to never run out of daily limits. Your key is saved locally.
            </p>
          </div>

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
            <label className="text-xs text-white/50 uppercase tracking-wider">Background Music</label>
            <select value={music} onChange={(e) => setMusic(e.target.value as any)} className="w-full mt-1 bg-white/5 border border-white/10 p-2 rounded-lg text-white">
              <option value="none">None</option>
              <option value="ambient">Ambient</option>
              <option value="lofi">Lo-Fi</option>
              <option value="nature">Nature</option>
              <option value="classical">Classical</option>
              <option value="focus">Focus</option>
              <option value="custom">Custom (Upload)</option>
            </select>
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
        </div>
      </div>
    </div>
  );
};
