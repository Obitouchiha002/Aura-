import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Users as UsersIcon } from 'lucide-react';

export default function UsersPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersQuery = query(collection(db, 'users'), orderBy('lastLoginAt', 'desc'));
        const usersSnap = await getDocs(usersQuery);
        const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching users", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  if(loading) return <div className="animate-pulse h-64 bg-surface rounded-2xl"></div>;

  return (
    <div className="space-y-6">
      <div className="bg-elevated border border-border rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center gap-3 bg-surface">
          <UsersIcon className="text-aura-red" size={20} />
          <h2 className="text-xl font-medium">Complete User Directory</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-elevated text-text-faint text-[10px] uppercase tracking-widest border-b border-border">
              <tr>
                <th className="px-6 py-4 font-normal">User</th>
                <th className="px-6 py-4 font-normal">Email</th>
                <th className="px-6 py-4 font-normal">Role</th>
                <th className="px-6 py-4 font-normal">Last Login</th>
                <th className="px-6 py-4 font-normal">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-text-faint">
                    No users yet.
                  </td>
                </tr>
              ) : users.map(user => (
                <tr key={user.id} className="hover:bg-surface transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 bg-surface-2 rounded-full flex items-center justify-center font-bold uppercase flex-shrink-0">
                          {user.displayName?.[0] || user.email?.[0] || '?'}
                        </div>
                      )}
                      <span className="font-medium whitespace-nowrap">{user.displayName || 'Anonymous'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-text-muted whitespace-nowrap">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] uppercase tracking-widest whitespace-nowrap ${user.role === 'admin' ? 'bg-accent-wash text-aura-red' : 'bg-surface-2 text-text-body'}`}>
                      {user.role || 'user'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text-muted whitespace-nowrap">
                    {user.lastLoginAt?.toDate ? user.lastLoginAt.toDate().toLocaleString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-text-muted whitespace-nowrap">
                    {user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : 'N/A'}
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
