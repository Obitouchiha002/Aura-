import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Settings as SettingsIcon, Save, Key, ShieldAlert, Megaphone } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

export default function SettingsPanel() {
  const { userApiKey, setUserApiKey } = useSettings();
  const [appSettings, setAppSettings] = useState({ maintenanceMode: false, welcomeMessage: '' });
  /** The banner every signed-in user sees, until they dismiss it. */
  const [notice, setNotice] = useState<{ active: boolean; title: string; body: string; kind: 'info' | 'update' | 'warning' }>(
    { active: false, title: '', body: '', kind: 'info' },
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsRef = doc(db, 'settings', 'global');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const d = settingsSnap.data();
          setAppSettings({ maintenanceMode: d.maintenanceMode || false, welcomeMessage: d.welcomeMessage || '' });
          if (d.notice) {
            setNotice({
              active: !!d.notice.active,
              title: d.notice.title || '',
              body: d.notice.body || '',
              kind: d.notice.kind || 'info',
            });
          }
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
      await setDoc(doc(db, 'settings', 'global'), { ...appSettings, notice }, { merge: true });
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

          {/* One banner, shown to everyone, everywhere in the app until they
              close it. Changing the words brings it back for people who had
              already dismissed the previous one. */}
          <div className="space-y-3 p-4 bg-bg rounded-xl border border-border">
            <div className="flex items-center gap-2">
              <Megaphone size={17} className="text-aura-red" />
              <label className="font-medium">Announcement</label>
              <label className="ml-auto flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={notice.active}
                  onChange={e => setNotice(p => ({ ...p, active: e.target.checked }))}
                  className="w-4 h-4 accent-aura-red"
                />
                Show it
              </label>
            </div>
            <p className="text-sm text-text-muted">
              Appears at the top of the app for every signed-in user. They can dismiss it;
              editing the text makes it appear again.
            </p>

            <div className="flex gap-2">
              {(['info', 'update', 'warning'] as const).map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setNotice(p => ({ ...p, kind: k }))}
                  className={`px-3 py-1.5 rounded-lg text-[13px] border capitalize transition-colors ${
                    notice.kind === k
                      ? 'border-aura-red text-aura-red bg-accent-wash'
                      : 'border-border text-text-muted hover:text-text-primary'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            <input
              value={notice.title}
              onChange={e => setNotice(p => ({ ...p, title: e.target.value }))}
              placeholder="Headline — e.g. Version 1.1 is out"
              className="w-full bg-elevated border border-border rounded-xl px-4 py-3 text-text-primary outline-none focus:border-aura-red/50 transition-colors"
            />
            <textarea
              value={notice.body}
              onChange={e => setNotice(p => ({ ...p, body: e.target.value }))}
              placeholder="A line or two. What changed, or what to expect."
              className="w-full bg-elevated border border-border rounded-xl px-4 py-3 text-text-primary min-h-[80px] outline-none focus:border-aura-red/50 transition-colors"
            />

            {(notice.title || notice.body) && (
              <div className="pt-1">
                <p className="text-[11px] uppercase tracking-widest text-text-faint mb-2">Preview</p>
                <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
                  {notice.title && <p className="text-[13.5px] font-semibold text-text-primary">{notice.title}</p>}
                  {notice.body && <p className="text-[13px] text-text-body mt-0.5">{notice.body}</p>}
                </div>
              </div>
            )}
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
