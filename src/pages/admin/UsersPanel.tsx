import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, query, orderBy, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Users as UsersIcon, Search, Ban, Check, Gauge, ShieldOff } from 'lucide-react';

/**
 * The user directory, and what can be done to an account from it.
 *
 * Three levers, matching the three things that actually go wrong: someone
 * needs a bigger or smaller daily allowance, someone needs stopping for a
 * while, or someone needs stopping for good. Each writes a field the app reads
 * before every send — see checkAndIncrementMessageLimit.
 */

const DEFAULT_LIMIT = 50;

interface Row {
  id: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  dailyLimit?: number;
  dailyMessageCount?: number;
  blocked?: boolean;
  blockedPermanently?: boolean;
  blockedReason?: string;
  lastLoginAt?: any;
  createdAt?: any;
}

export default function UsersPanel() {
  const [users, setUsers] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('lastLoginAt', 'desc')));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Row)));
    } catch (e: any) {
      setError(e?.message || 'Could not load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /** Writes one change and reflects it locally, so the table does not blink. */
  const patch = async (id: string, fields: Record<string, unknown>) => {
    setBusy(id);
    setError(null);
    try {
      await setDoc(doc(db, 'users', id), fields, { merge: true });
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...fields } as Row : u)));
    } catch (e: any) {
      setError(e?.message || 'Could not save that change.');
    } finally {
      setBusy(null);
    }
  };

  const pause = (u: Row) => {
    if (u.blocked) return patch(u.id, { blocked: false, blockedReason: '' });
    const reason = window.prompt(
      `Pause ${u.email || u.id}?\n\nThey will be told the account is paused. Add a reason if you want them to see one:`,
      '',
    );
    if (reason === null) return;
    patch(u.id, { blocked: true, blockedReason: reason.trim() });
  };

  const close = (u: Row) => {
    if (u.blockedPermanently) {
      if (!window.confirm(`Reopen ${u.email || u.id}? They will be able to send again.`)) return;
      return patch(u.id, { blockedPermanently: false, blocked: false, blockedReason: '' });
    }
    const reason = window.prompt(
      `Close ${u.email || u.id} permanently?\n\nThis is the hard stop — for abuse, not for a bad day. It can be undone from here.\n\nReason shown to them (optional):`,
      '',
    );
    if (reason === null) return;
    patch(u.id, { blockedPermanently: true, blockedReason: reason.trim() });
  };

  const setLimit = (u: Row) => {
    const current = typeof u.dailyLimit === 'number' ? u.dailyLimit : DEFAULT_LIMIT;
    const next = window.prompt(
      `Daily message limit for ${u.email || u.id}.\n\nEveryone gets ${DEFAULT_LIMIT} by default. Past the limit they keep going on the slower model rather than stopping.\n\nLeave blank to go back to the default.`,
      String(current),
    );
    if (next === null) return;
    // Deleting the field, rather than writing 0, is what restores the default.
    if (next.trim() === '') return patch(u.id, { dailyLimit: null });
    const n = Number(next);
    if (!Number.isFinite(n) || n < 0) {
      setError('A limit has to be a number, zero or more.');
      return;
    }
    patch(u.id, { dailyLimit: Math.floor(n) });
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(u =>
      (u.email || '').toLowerCase().includes(needle)
      || (u.displayName || '').toLowerCase().includes(needle),
    );
  }, [users, q]);

  const stopped = users.filter(u => u.blocked || u.blockedPermanently).length;

  if (loading) return <div className="animate-pulse h-64 bg-surface rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div className="bg-elevated border border-border rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-surface flex flex-wrap items-center gap-4">
          <UsersIcon className="text-aura-red" size={20} />
          <h2 className="text-xl font-medium mr-auto">
            Users
            <span className="ml-3 text-[13px] text-text-muted font-normal">
              {users.length} total{stopped > 0 ? ` · ${stopped} stopped` : ''}
            </span>
          </h2>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search name or email"
              className="pl-9 pr-3 py-2 rounded-xl bg-bg border border-border text-[13.5px] w-56 focus:outline-none focus:border-border-strong"
            />
          </div>
        </div>

        {error && (
          <p className="px-6 py-3 text-[13px] text-danger border-b border-border bg-accent-wash">{error}</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-elevated text-text-faint text-[10px] uppercase tracking-widest border-b border-border">
              <tr>
                <th className="px-6 py-4 font-normal">User</th>
                <th className="px-6 py-4 font-normal">Status</th>
                <th className="px-6 py-4 font-normal">Today</th>
                <th className="px-6 py-4 font-normal">Last login</th>
                <th className="px-6 py-4 font-normal text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-text-faint">
                    {users.length === 0 ? 'No users yet.' : 'Nobody matches that.'}
                  </td>
                </tr>
              ) : shown.map(u => {
                const limit = typeof u.dailyLimit === 'number' ? u.dailyLimit : DEFAULT_LIMIT;
                const used = u.dailyMessageCount || 0;
                return (
                  <tr key={u.id} className={`hover:bg-surface transition-colors ${busy === u.id ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 bg-surface-2 rounded-full flex items-center justify-center font-bold uppercase shrink-0">
                            {u.displayName?.[0] || u.email?.[0] || '?'}
                          </div>
                        )}
                        <span className="flex flex-col min-w-0">
                          <span className="font-medium truncate">{u.displayName || 'Anonymous'}</span>
                          <span className="text-[12px] text-text-muted truncate">{u.email}</span>
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {u.blockedPermanently ? (
                        <span className="px-2 py-1 rounded-full text-[10px] uppercase tracking-widest bg-accent-wash text-danger whitespace-nowrap">Closed</span>
                      ) : u.blocked ? (
                        <span className="px-2 py-1 rounded-full text-[10px] uppercase tracking-widest bg-surface-2 text-warn whitespace-nowrap">Paused</span>
                      ) : u.role === 'admin' ? (
                        <span className="px-2 py-1 rounded-full text-[10px] uppercase tracking-widest bg-accent-wash text-aura-red whitespace-nowrap">Admin</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-[10px] uppercase tracking-widest bg-surface-2 text-text-body whitespace-nowrap">Active</span>
                      )}
                      {u.blockedReason && (
                        <p className="text-[11.5px] text-text-faint mt-1.5 max-w-[22ch]">{u.blockedReason}</p>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono tabular-nums text-text-body">{used}</span>
                      <span className="text-text-faint"> / {limit}</span>
                      {typeof u.dailyLimit === 'number' && (
                        <span className="ml-2 text-[10px] uppercase tracking-widest text-text-faint">set</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-text-muted whitespace-nowrap">
                      {u.lastLoginAt?.toDate ? u.lastLoginAt.toDate().toLocaleDateString() : '—'}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => setLimit(u)}
                          disabled={busy === u.id}
                          title="Daily limit"
                          className="px-2.5 py-1.5 rounded-lg border border-border text-text-muted hover:text-text-primary hover:border-border-strong transition-colors flex items-center gap-1.5 text-[12px]"
                        >
                          <Gauge size={13} /> Limit
                        </button>
                        <button
                          onClick={() => pause(u)}
                          disabled={busy === u.id || u.blockedPermanently}
                          title={u.blocked ? 'Let them back in' : 'Pause this account'}
                          className={`px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 text-[12px] disabled:opacity-40 ${
                            u.blocked
                              ? 'border-success/40 text-success hover:bg-success/10'
                              : 'border-border text-text-muted hover:text-warn hover:border-warn/40'
                          }`}
                        >
                          {u.blocked ? <><Check size={13} /> Unpause</> : <><Ban size={13} /> Pause</>}
                        </button>
                        <button
                          onClick={() => close(u)}
                          disabled={busy === u.id}
                          title={u.blockedPermanently ? 'Reopen this account' : 'Close permanently'}
                          className={`px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 text-[12px] ${
                            u.blockedPermanently
                              ? 'border-success/40 text-success hover:bg-success/10'
                              : 'border-border text-text-muted hover:text-danger hover:border-danger/40'
                          }`}
                        >
                          <ShieldOff size={13} /> {u.blockedPermanently ? 'Reopen' : 'Close'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
