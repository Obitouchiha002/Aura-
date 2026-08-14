import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Plus, Trash2, Users } from 'lucide-react';

export default function CharactersPanel() {
  const [characters, setCharacters] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('MENTOR');
  const [loading, setLoading] = useState(false);

  const fetchCharacters = async () => {
    try {
      const q = query(collection(db, 'custom_characters'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      setCharacters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching custom characters", error);
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'custom_characters'), {
        name: name.trim(),
        category,
        createdAt: Date.now()
      });
      setName('');
      fetchCharacters();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'custom_characters', id));
      fetchCharacters();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-bg border border-border rounded-2xl p-6">
        <h3 className="text-lg font-medium text-text-primary mb-4">Add Custom Character</h3>
        <form onSubmit={handleAdd} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-xs text-text-muted uppercase tracking-wider mb-2 block">Name</label>
            <input 
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Albert Einstein"
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-aura-red"
            />
          </div>
          <div className="w-48">
            <label className="text-xs text-text-muted uppercase tracking-wider mb-2 block">Category (Mode)</label>
            <select 
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-aura-red"
            >
              <option value="MENTOR">Mentor</option>
              <option value="EMOTION">Emotion (Poets)</option>
              <option value="COUNCIL">Council</option>
              <option value="TEACHER">Teacher</option>
              <option value="PSYCHOLOGY">Psychology</option>
            </select>
          </div>
          <button 
            type="submit" 
            disabled={loading || !name.trim()}
            className="bg-aura-red text-on-accent px-6 py-3 rounded-xl font-bold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus size={18} /> Add
          </button>
        </form>
      </div>

      <div className="bg-bg border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border bg-bg">
          <h3 className="text-sm font-medium text-text-body">Custom Characters Library</h3>
        </div>
        <div className="divide-y divide-border">
          {characters.length === 0 ? (
            <div className="p-8 text-center text-text-faint text-sm">
              No custom characters added yet.
            </div>
          ) : (
            characters.map(char => (
              <div key={char.id} className="flex items-center justify-between p-4 hover:bg-surface transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-aura-red/10 flex items-center justify-center text-aura-red border border-aura-red/20">
                    <Users size={16} />
                  </div>
                  <div>
                    <h4 className="text-text-primary font-medium">{char.name}</h4>
                    <p className="text-xs text-text-faint uppercase tracking-wider">{char.category}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(char.id)}
                  className="p-2 text-text-faint hover:text-aura-red transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
