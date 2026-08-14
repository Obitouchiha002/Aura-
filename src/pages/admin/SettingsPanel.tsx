import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Settings as SettingsIcon, Save, Key, ShieldAlert } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

export default function SettingsPanel() {
  const { userApiKey, setUserApiKey } = useSettings();
  const [appSettings, setAppSettings] = useState({ maintenanceMode: false, welcomeMessage: '' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsRef = doc(db, 'settings', 'global');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          setAppSettings({ maintenanceMode: settingsSnap.data().maintenanceMode || false, welcomeMessage: settingsSnap.data().welcomeMessage || '' });
        }
      } catch (error) {
        console.error("Error fetching settings", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), appSettings, { merge: true });
      alert('Global Settings saved successfully!');
    } catch (error) {
      console.error("Error saving settings", error);
      alert('Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  if(loading) return <div className="animate-pulse h-64 bg-surface rounded-2xl"></div>;

  return (
    <div className="space-y-6">
      <div className="bg-elevated border border-border rounded-2xl overflow-hidden p-6">
        <div className="flex items-center space-x-3 mb-6">
          <SettingsIcon className="w-6 h-6 text-aura-red" />
          <h2 className="text-xl font-medium">Global App Settings</h2>
        </div>
        
        <div className="space-y-6 max-w-2xl">
          <div className="flex items-center justify-between p-4 bg-bg rounded-xl border border-border">
            <div>
              <h3 className="font-medium">Maintenance Mode</h3>
              <p className="text-sm text-text-muted">Lock the app for all non-admin users.</p>
            </div>
            <input 
              type="checkbox" 
              checked={appSettings.maintenanceMode}
              onChange={(e) => setAppSettings(prev => ({ ...prev, maintenanceMode: e.target.checked }))}
              className="w-6 h-6 accent-aura-red cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <label className="font-medium block">Global Welcome Message</label>
            <p className="text-sm text-text-muted">Display a message to all users on the home screen.</p>
            <textarea 
              value={appSettings.welcomeMessage}
              onChange={(e) => setAppSettings(prev => ({ ...prev, welcomeMessage: e.target.value }))}
              className="w-full bg-bg border border-border rounded-xl p-4 text-text-primary min-h-[100px] outline-none focus:border-aura-red/50 transition-colors"
              placeholder="Enter an announcement or welcome message..."
            />
          </div>

          <div className="space-y-2 p-4 bg-bg rounded-xl border border-border">
            <div className="flex items-center space-x-2 mb-2">
              <Key className="w-5 h-5 text-aura-red" />
              <label className="font-medium block">Custom Admin Gemini Key</label>
            </div>
            <p className="text-sm text-text-muted">Set a custom API key for this browser session.</p>
            <input
              type="password"
              value={userApiKey || ''}
              onChange={(e) => setUserApiKey(e.target.value)}
              placeholder="Enter your own key to bypass limits"
              className="w-full bg-bg border border-border rounded-xl p-4 text-text-primary outline-none focus:border-aura-red/50 transition-colors"
            />
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="flex items-center space-x-2 bg-aura-red text-on-accent px-6 py-3 rounded-full font-bold hover:opacity-90 transition-opacity disabled:opacity-50 mt-4"
          >
            <Save className="w-5 h-5" />
            <span>{savingSettings ? 'Saving...' : 'Save All Settings'}</span>
          </button>

          <div className="space-y-2 p-4 bg-aura-red/5 rounded-xl border border-aura-red/20 mt-8">
            <div className="flex items-center space-x-2 mb-2 text-aura-red">
              <ShieldAlert className="w-5 h-5" />
              <label className="font-medium block">Danger Zone</label>
            </div>
            <p className="text-sm text-text-muted mb-4">Actions here are irreversible.</p>
            {/* Bulk deletion needs privileges the browser SDK doesn't have, so
                this is shown as unavailable rather than confirming and then
                admitting it does nothing. */}
            <button
              disabled
              title="Requires a Cloud Function — not available from the browser"
              className="w-full bg-danger/10 text-danger p-3 rounded-xl border border-danger/30 text-sm font-bold opacity-60 cursor-not-allowed"
            >
              Clear All Chat Sessions
            </button>
            <p className="text-xs text-text-faint mt-2">
              Needs a Cloud Function with admin privileges — not available from the dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
