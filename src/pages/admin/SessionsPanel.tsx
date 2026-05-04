import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { MessageSquare, Flame, Clock, Hash } from 'lucide-react';

export default function SessionsPanel() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const sessionsQuery = query(collection(db, 'sessions'), orderBy('startTime', 'desc'));
        const sessionsSnap = await getDocs(sessionsQuery);
        const sessionsData = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSessions(sessionsData);
      } catch (error) {
        console.error("Error fetching sessions", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  if(loading) return <div className="animate-pulse h-64 bg-white/5 rounded-2xl"></div>;

  return (
    <div className="space-y-6">
      <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3 bg-white/5">
          <MessageSquare className="text-aura-red" size={20} />
          <h2 className="text-xl font-medium">Chat Sessions History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0f0f0f] text-white/40 text-[10px] uppercase tracking-widest border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-normal">Session Mode</th>
                <th className="px-6 py-4 font-normal">Email</th>
                <th className="px-6 py-4 font-normal">Start Time</th>
                <th className="px-6 py-4 font-normal">Duration</th>
                <th className="px-6 py-4 font-normal">Messages</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-sm">
              {sessions.map(session => (
                <tr key={session.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium uppercase tracking-widest text-[10px] text-white/70 bg-white/5">
                    {session.mode || 'CHAT'}
                  </td>
                  <td className="px-6 py-4 text-white/60">{session.email}</td>
                  <td className="px-6 py-4 text-white/60">
                    {session.startTime?.toDate ? session.startTime.toDate().toLocaleString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-white/60">
                    {formatDuration(session.durationSeconds || 0)}
                  </td>
                  <td className="px-6 py-4 font-mono text-aura-red">
                    {session.messages?.length || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
