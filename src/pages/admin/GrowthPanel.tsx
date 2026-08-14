import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { TrendingUp, Users, Share2, UserPlus } from 'lucide-react';

export default function GrowthPanel() {
  const [stats, setStats] = useState({ linkShares: 0, referralSignups: 0 });
  const [topReferrers, setTopReferrers] = useState<{ name: string; email: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // These numbers used to be hardcoded placeholders; they now come from the
  // invitesSent / referredBy fields the app already writes.
  useEffect(() => {
    const fetchGrowth = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

        const linkShares = users.reduce((acc, u) => acc + (u.invitesSent || 0), 0);
        const referred = users.filter(u => !!u.referredBy);

        const counts = new Map<string, number>();
        referred.forEach(u => counts.set(u.referredBy, (counts.get(u.referredBy) || 0) + 1));

        const byUid = new Map(users.map(u => [u.id, u]));
        const leaderboard = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([uid, count]) => {
            const u = byUid.get(uid);
            return {
              name: u?.displayName || 'Unknown user',
              email: u?.email || uid,
              count,
            };
          });

        setStats({ linkShares, referralSignups: referred.length });
        setTopReferrers(leaderboard);
      } catch (error) {
        console.error('Error fetching growth data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchGrowth();
  }, []);

  if (loading) return <div className="animate-pulse h-64 bg-surface rounded-2xl"></div>;

  const conversion = stats.linkShares > 0
    ? Math.round((stats.referralSignups / stats.linkShares) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="bg-elevated border border-border rounded-2xl p-6">
        <h3 className="text-lg font-medium mb-6 flex items-center gap-2">
          <TrendingUp size={18} className="text-aura-red" /> Growth Insights
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-bg rounded-xl border border-border">
            <Share2 className="text-aura-red mb-2" size={16} />
            <h4 className="text-xs uppercase tracking-widest text-text-faint mb-1">Total Link Shares</h4>
            <p className="text-2xl font-bold">{stats.linkShares.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-bg rounded-xl border border-border">
            <UserPlus className="text-blue-500 mb-2" size={16} />
            <h4 className="text-xs uppercase tracking-widest text-text-faint mb-1">Referral Signups</h4>
            <p className="text-2xl font-bold">{stats.referralSignups.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-bg rounded-xl border border-border">
            <Users className="text-success mb-2" size={16} />
            <h4 className="text-xs uppercase tracking-widest text-text-faint mb-1">Share → Signup</h4>
            <p className="text-2xl font-bold">{conversion}%</p>
          </div>
        </div>
      </div>

      <div className="bg-elevated border border-border rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-surface">
          <h3 className="text-lg font-medium">Top Referrers</h3>
          <p className="text-xs text-text-faint mt-1">Users who brought the most people in</p>
        </div>
        <div className="divide-y divide-border">
          {topReferrers.length === 0 ? (
            <div className="p-8 text-center text-text-faint text-sm">
              No referral signups recorded yet.
            </div>
          ) : (
            topReferrers.map((r, i) => (
              <div key={r.email} className="flex items-center justify-between gap-4 p-4 hover:bg-surface transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="w-7 h-7 rounded-full bg-accent-wash text-aura-red flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-text-faint truncate">{r.email}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-aura-red flex-shrink-0">{r.count}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
