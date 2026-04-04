import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Users, Clock, Activity, ArrowLeft, Settings as SettingsIcon, Save, Key } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export const AdminDashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { userApiKey, setUserApiKey } = useSettings();
  const [users, setUsers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [appSettings, setAppSettings] = useState({ maintenanceMode: false, welcomeMessage: '' });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersQuery = query(collection(db, 'users'), orderBy('lastLoginAt', 'desc'));
        const usersSnap = await getDocs(usersQuery);
        const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersData);

        const sessionsQuery = query(collection(db, 'sessions'), orderBy('startTime', 'desc'));
        const sessionsSnap = await getDocs(sessionsQuery);
        const sessionsData = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSessions(sessionsData);

        const settingsRef = doc(db, 'settings', 'global');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          setAppSettings(settingsSnap.data() as any);
        }
      } catch (error) {
        console.error("Error fetching admin stats", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), appSettings);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error("Error saving settings", error);
      alert('Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const totalDuration = sessions.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
  const avgDuration = sessions.length > 0 ? Math.floor(totalDuration / sessions.length) : 0;

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-serif italic text-aura-red">Admin Dashboard</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-aura-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex items-center space-x-4">
                <div className="p-3 bg-aura-red/20 rounded-xl">
                  <Users className="w-6 h-6 text-aura-red" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Users</p>
                  <p className="text-2xl font-bold">{users.length}</p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex items-center space-x-4">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <Activity className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Sessions</p>
                  <p className="text-2xl font-bold">{sessions.length}</p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex items-center space-x-4">
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <Clock className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Avg Session Time</p>
                  <p className="text-2xl font-bold">{formatDuration(avgDuration)}</p>
                </div>
              </div>
            </div>

            {/* App Settings */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden p-6">
              <div className="flex items-center space-x-3 mb-6">
                <SettingsIcon className="w-6 h-6 text-aura-red" />
                <h2 className="text-xl font-medium">Global App Settings</h2>
              </div>
              
              <div className="space-y-6 max-w-2xl">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <h3 className="font-medium">Maintenance Mode</h3>
                    <p className="text-sm text-gray-400">Lock the app for all non-admin users.</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={appSettings.maintenanceMode}
                    onChange={(e) => setAppSettings(prev => ({ ...prev, maintenanceMode: e.target.checked }))}
                    className="w-6 h-6 accent-aura-red"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-medium block">Global Welcome Message</label>
                  <p className="text-sm text-gray-400">Display a message to all users on the home screen.</p>
                  <textarea 
                    value={appSettings.welcomeMessage}
                    onChange={(e) => setAppSettings(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white min-h-[100px]"
                    placeholder="Enter an announcement or welcome message..."
                  />
                </div>

                <div className="space-y-2 p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center space-x-2 mb-2">
                    <Key className="w-5 h-5 text-aura-red" />
                    <label className="font-medium block">Custom Gemini API Key</label>
                  </div>
                  <p className="text-sm text-gray-400">Set a custom API key for the app to bypass default limits.</p>
                  <input
                    type="password"
                    value={userApiKey || ''}
                    onChange={(e) => setUserApiKey(e.target.value)}
                    placeholder="Enter your own key to bypass limits"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    This key is saved locally in your browser.
                  </p>
                </div>

                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="flex items-center space-x-2 bg-aura-red text-black px-6 py-3 rounded-full font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  <span>{savingSettings ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            </div>

            {/* Users List */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <h2 className="text-xl font-medium">Recent Users</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/5 text-gray-400 text-sm">
                    <tr>
                      <th className="px-6 py-4 font-medium">User</th>
                      <th className="px-6 py-4 font-medium">Email</th>
                      <th className="px-6 py-4 font-medium">Role</th>
                      <th className="px-6 py-4 font-medium">Last Login</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 flex items-center space-x-3">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                              {user.displayName?.[0] || user.email?.[0] || '?'}
                            </div>
                          )}
                          <span>{user.displayName || 'Anonymous'}</span>
                        </td>
                        <td className="px-6 py-4 text-gray-400">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${user.role === 'admin' ? 'bg-aura-red/20 text-aura-red' : 'bg-white/10 text-gray-300'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-sm">
                          {user.lastLoginAt?.toDate ? user.lastLoginAt.toDate().toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sessions List */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <h2 className="text-xl font-medium">Recent Sessions</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/5 text-gray-400 text-sm">
                    <tr>
                      <th className="px-6 py-4 font-medium">Email</th>
                      <th className="px-6 py-4 font-medium">Start Time</th>
                      <th className="px-6 py-4 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {sessions.slice(0, 50).map(session => (
                      <tr key={session.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-gray-400">{session.email}</td>
                        <td className="px-6 py-4 text-gray-400 text-sm">
                          {session.startTime?.toDate ? session.startTime.toDate().toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-sm">
                          {formatDuration(session.durationSeconds || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
