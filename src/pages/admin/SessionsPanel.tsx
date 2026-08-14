import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { MessageSquare } from 'lucide-react';

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

  if(loading) return <div className="animate-pulse h-64 bg-surface rounded-2xl"></div>;

  return (
    <div className="space-y-6">
      <div className="bg-elevated border border-border rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center gap-3 bg-surface">
          <MessageSquare className="text-aura-red" size={20} />
          <h2 className="text-xl font-medium">Chat Sessions History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-elevated text-text-faint text-[10px] uppercase tracking-widest border-b border-border">
              {/* Session docs only carry uid/email/times/duration — the old
                  "Session Mode" and "Messages" columns were always empty. */}
              <tr>
                <th className="px-6 py-4 font-normal">Email</th>
                <th className="px-6 py-4 font-normal">Start Time</th>
                <th className="px-6 py-4 font-normal">Last Seen</th>
                <th className="px-6 py-4 font-normal">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-text-faint">
                    No sessions recorded yet.
                  </td>
                </tr>
              ) : sessions.map(session => (
                <tr key={session.id} className="hover:bg-surface transition-colors">
                  <td className="px-6 py-4 text-text-body whitespace-nowrap">{session.email || '—'}</td>
                  <td className="px-6 py-4 text-text-muted whitespace-nowrap">
                    {session.startTime?.toDate ? session.startTime.toDate().toLocaleString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-text-muted whitespace-nowrap">
                    {session.endTime?.toDate ? session.endTime.toDate().toLocaleString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-text-muted font-mono whitespace-nowrap">
                    {formatDuration(session.durationSeconds || 0)}
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
