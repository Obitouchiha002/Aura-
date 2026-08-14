import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Users, Clock, Activity, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

/** Firestore Timestamp | Date | millis → Date, or null when unusable. */
function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

const dayKey = (d: Date) => d.toISOString().split('T')[0];

export default function OverviewPanel({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [stats, setStats] = useState({ totalUsers: 0, activeToday: 0, avgSession: 0, totalSessions: 0 });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [chartData, setChartData] = useState<{ name: string; signups: number; sessions: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersQuery = query(collection(db, 'users'), orderBy('lastLoginAt', 'desc'), limit(100));
        const usersSnap = await getDocs(usersQuery);
        const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

        const sessionsQuery = query(collection(db, 'sessions'), orderBy('startTime', 'desc'), limit(100));
        const sessionsSnap = await getDocs(sessionsQuery);
        const sessionsData = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

        const totalDuration = sessionsData.reduce((acc, curr: any) => acc + (curr.durationSeconds || 0), 0);
        const avgDuration = sessionsData.length > 0 ? Math.floor(totalDuration / sessionsData.length) : 0;

        // "Active today" means logged in today — this tile used to just repeat
        // the total user count.
        const today = dayKey(new Date());
        const activeToday = usersData.filter(u => {
          const last = toDate(u.lastLoginAt);
          return last ? dayKey(last) === today : false;
        }).length;

        setStats({
          totalUsers: usersData.length,
          activeToday,
          avgSession: avgDuration,
          totalSessions: sessionsData.length,
        });

        // Real 7-day trend, built from the documents we already fetched, in
        // place of the hardcoded numbers that used to sit here.
        const days: { name: string; key: string; signups: number; sessions: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          days.push({
            name: d.toLocaleDateString(undefined, { weekday: 'short' }),
            key: dayKey(d),
            signups: 0,
            sessions: 0,
          });
        }
        const byKey = new Map(days.map(d => [d.key, d]));
        usersData.forEach(u => {
          const created = toDate(u.createdAt);
          const bucket = created && byKey.get(dayKey(created));
          if (bucket) bucket.signups += 1;
        });
        sessionsData.forEach(s => {
          const started = toDate(s.startTime);
          const bucket = started && byKey.get(dayKey(started));
          if (bucket) bucket.sessions += 1;
        });
        setChartData(days.map(({ name, signups, sessions }) => ({ name, signups, sessions })));

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

  if (loading) return <div className="animate-pulse h-64 bg-surface rounded-2xl"></div>;

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Active Today', value: stats.activeToday, icon: Activity, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Avg Session', value: formatDuration(stats.avgSession), icon: Clock, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Total Sessions', value: stats.totalSessions, icon: TrendingUp, color: 'text-aura-red', bg: 'bg-aura-red/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-elevated border border-border p-6 rounded-2xl relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl ${stat.bg} -mr-10 -mt-10 rounded-full opacity-50 group-hover:opacity-100 transition-opacity`} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-text-muted text-sm font-medium tracking-wide">{stat.label}</span>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-elevated border border-border rounded-2xl p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium">Last 7 Days</h3>
            <p className="text-xs text-text-faint">Signups and sessions, from the 100 most recent records</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-faint)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-faint)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    color: 'var(--text-primary)',
                  }}
                  labelStyle={{ color: 'var(--text-muted)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  cursor={{ stroke: 'var(--border-strong)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" name="Sessions" dataKey="sessions" stroke="var(--accent)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSessions)" />
                <Area type="monotone" name="Signups" dataKey="signups" stroke="#6366F1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSignups)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-elevated border border-border rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium">Recent Users</h3>
            <button onClick={() => onNavigate('users')} className="text-aura-red hover:text-text-primary transition-colors text-sm">View All</button>
          </div>
          <div className="space-y-4">
            {recentUsers.length === 0 ? (
              <p className="text-sm text-text-faint">No users yet.</p>
            ) : recentUsers.map(user => (
              <div key={user.id} className="flex items-center gap-3 p-3 bg-surface rounded-xl hover:bg-surface-2 transition-colors">
                <div className="w-10 h-10 rounded-full bg-accent-wash border border-border flex items-center justify-center font-bold overflow-hidden uppercase flex-shrink-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user.displayName?.[0] || user.email?.[0] || '?'
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">{user.displayName || 'Anonymous'}</p>
                  <p className="text-xs text-text-faint truncate">{user.email}</p>
                </div>
                {user.role === 'admin' && (
                  <div className="text-[10px] text-aura-red uppercase tracking-widest px-2 py-1 bg-accent-wash rounded-md flex-shrink-0">
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
