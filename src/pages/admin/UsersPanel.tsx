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

  if(loading) return <div className="animate-pulse h-64 bg-white/5 rounded-2xl"></div>;

  return (
    <div className="space-y-6">
      <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3 bg-white/5">
          <UsersIcon className="text-aura-red" size={20} />
          <h2 className="text-xl font-medium">Complete User Directory</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0f0f0f] text-white/40 text-[10px] uppercase tracking-widest border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-normal">User</th>
                <th className="px-6 py-4 font-normal">Email</th>
                <th className="px-6 py-4 font-normal">Role</th>
                <th className="px-6 py-4 font-normal">Last Login</th>
                <th className="px-6 py-4 font-normal">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-sm">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 flex items-center space-x-3">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center font-bold">
                        {user.displayName?.[0] || user.email?.[0] || '?'}
                      </div>
                    )}
                    <span className="font-medium">{user.displayName || 'Anonymous'}</span>
                  </td>
                  <td className="px-6 py-4 text-white/60">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] uppercase tracking-widest ${user.role === 'admin' ? 'bg-aura-red/20 text-aura-red' : 'bg-white/10 text-gray-300'}`}>
                      {user.role || 'user'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white/60">
                    {user.lastLoginAt?.toDate ? user.lastLoginAt.toDate().toLocaleString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-white/60">
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
