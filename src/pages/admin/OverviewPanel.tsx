import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Users, Clock, Activity, TrendingUp, Search } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function OverviewPanel({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [stats, setStats] = useState({ totalUsers: 0, activeToday: 0, avgSession: 0, totalSessions: 0 });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Still fake chart data due to lack of historical timeseries aggregation logic in Firebase currently
  const chartData = [
    { name: 'Mon', users: 4, sessions: 2 },
    { name: 'Tue', users: 3, sessions: 1 },
    { name: 'Wed', users: 2, sessions: 9 },
    { name: 'Thu', users: 2, sessions: 3 },
    { name: 'Fri', users: 1, sessions: 4 },
    { name: 'Sat', users: 2, sessions: 3 },
    { name: 'Sun', users: 3, sessions: 4 },
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersQuery = query(collection(db, 'users'), orderBy('lastLoginAt', 'desc'), limit(100));
        const usersSnap = await getDocs(usersQuery);
        const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const sessionsQuery = query(collection(db, 'sessions'), orderBy('startTime', 'desc'), limit(100));
        const sessionsSnap = await getDocs(sessionsQuery);
        const sessionsData = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const totalDuration = sessionsData.reduce((acc, curr: any) => acc + (curr.durationSeconds || 0), 0);
        const avgDuration = sessionsData.length > 0 ? Math.floor(totalDuration / sessionsData.length) : 0;

        setStats({
          totalUsers: usersData.length,
          activeToday: usersData.length,
          avgSession: avgDuration,
          totalSessions: sessionsData.length,
        });
        
        setRecentUsers(usersData.slice(0, 5));
      } catch (error) {
        console.error("Error fetching overview", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  if(loading) return <div className="animate-pulse h-64 bg-white/5 rounded-2xl"></div>;

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Active Today', value: stats.activeToday, icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Avg Session', value: formatDuration(stats.avgSession), icon: Clock, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Total Sessions', value: stats.totalSessions, icon: TrendingUp, color: 'text-aura-red', bg: 'bg-aura-red/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#0f0f0f] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl ${stat.bg} -mr-10 -mt-10 rounded-full opacity-50 group-hover:opacity-100 transition-opacity`} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/50 text-sm font-medium tracking-wide">{stat.label}</span>
                <span className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                  <stat.icon size={18} />
                </span>
              </div>
              <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts & Lists */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium">Traffic Overview (Simulation)</h3>
            <select className="bg-black border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/70 outline-none">
              <option>Last 7 Days</option>
              <option>This Month</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff30" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff30" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', borderColor: '#ffffff20', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="users" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium">Recent Users</h3>
            <button onClick={() => onNavigate('users')} className="text-aura-red hover:text-white transition-colors text-sm">View All</button>
          </div>
          <div className="space-y-4">
            {recentUsers.map(user => (
              <div key={user.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-aura-red/20 to-black border border-white/10 flex items-center justify-center font-bold">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-full h-full rounded-full" />
                  ) : (
                    user.displayName?.[0] || user.email?.[0] || '?'
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">{user.displayName || 'Anonymous'}</p>
                  <p className="text-xs text-white/40 truncate">{user.email}</p>
                </div>
                {user.role === 'admin' && (
                  <div className="text-[10px] text-aura-red uppercase tracking-widest px-2 py-1 bg-aura-red/10 rounded-md">
                    Admin
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
