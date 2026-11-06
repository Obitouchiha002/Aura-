import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Plus, Trash2, ChevronLeft, Search } from 'lucide-react';
import type { Council } from '../services/councils';
import { newCouncilId } from '../services/councils';

/**
 * Where a council is chosen, and where one is built.
 *
 * The house council is twenty-five people and answers everything, which is
 * right for "what do I do about this" and wrong for a subject someone returns
 * to for six months. A business does not want Ghalib's view on its pricing,
 * and — more to the point — does not want last week's argument about someone's
 * brother turning up in the middle of a pricing conversation.
 *
 * Two screens, because they are two different acts: picking the room you want
 * to be in, and deciding who sits in it. Mixing them produced a list of
 * councils with checkboxes hanging off it, which read as neither.
 */
export const CouncilSheet: React.FC<{
  lang: string;
  roster: string[];
  councils: Council[];
  current?: string;
  onPick: (id: string) => void;
  onSave: (council: Council) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  displayName: (c: string) => { name: string; source?: string };
}> = ({ lang, roster, councils, current, onPick, onSave, onDelete, onClose, displayName }) => {
  const en = lang === 'en';
  const [editing, setEditing] = useState<Council | null>(null);
  const [q, setQ] = useState('');

  const blank = (): Council => ({
    id: newCouncilId(), name: '', about: '', members: [], createdAt: Date.now(),
  });

  const toggle = (name: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      members: editing.members.includes(name)
        ? editing.members.filter(m => m !== name)
        : [...editing.members, name],
    });
  };

  const shown = roster.filter(c => c.toLowerCase().includes(q.trim().toLowerCase()));
  // Two is a room. One is a mentor with extra steps, and the prompt falls back
  // to the house council below that, so saving one would be a lie.
  const canSave = !!editing && editing.name.trim().length > 0 && editing.members.length >= 2;

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-scrim" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed z-[95] inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:top-20 sm:left-1/2 sm:-translate-x-1/2 sm:w-[30rem] max-h-[82vh] flex flex-col bg-elevated border border-border rounded-t-3xl sm:rounded-3xl shadow-float overflow-hidden"
      >
        <div className="sm:hidden pt-2 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1 rounded-full bg-border-strong" />
        </div>

        {!editing ? (
          <>
            <div className="px-5 pt-3 pb-3 shrink-0">
              <h3 className="text-[17px] font-display font-medium text-text-primary">
                {en ? 'Councils' : 'परिषदें'}
              </h3>
              <p className="text-[12.5px] text-text-muted mt-1 leading-snug">
                {en
                  ? 'Keep a subject in its own room, with the people you want in it. Nothing said in one reaches another.'
                  : 'हर विषय का अपना कमरा — उन्हीं लोगों के साथ जिन्हें आप चाहें। एक की बात दूसरे तक नहीं जाती।'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-3 scrollbar-hide">
              <button
                onClick={() => onPick('')}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors ${
                  !current ? 'bg-mode-wash border-mode-tint/40' : 'border-transparent hover:bg-surface-2'
                }`}
              >
                <span className="flex flex-col min-w-0 flex-1">
                  <span className={`text-[14px] font-medium ${!current ? 'text-mode-tint' : 'text-text-primary'}`}>
                    {en ? 'The whole house' : 'पूरा सदन'}
                  </span>
                  <span className="text-[11.5px] text-text-faint mt-0.5">
                    {en ? `All ${roster.length} voices` : `सभी ${roster.length} आवाज़ें`}
                  </span>
                </span>
                {!current && <Check size={15} className="text-mode-tint shrink-0" />}
              </button>

              {councils.map(c => (
                <div
                  key={c.id}
                  className={`group w-full flex items-center gap-2 p-3 rounded-2xl border transition-colors ${
                    current === c.id ? 'bg-mode-wash border-mode-tint/40' : 'border-transparent hover:bg-surface-2'
                  }`}
                >
                  <button onClick={() => onPick(c.id)} className="flex flex-col min-w-0 flex-1 text-left">
                    <span className={`text-[14px] font-medium truncate ${current === c.id ? 'text-mode-tint' : 'text-text-primary'}`}>
                      {c.name}
                    </span>
                    <span className="text-[11.5px] text-text-faint mt-0.5 truncate">
                      {c.members.length} {en ? 'voices' : 'आवाज़ें'}
                      {c.about ? ` · ${c.about}` : ''}
                    </span>
                  </button>
                  {current === c.id && <Check size={15} className="text-mode-tint shrink-0" />}
                  <button
                    onClick={() => setEditing({ ...c })}
                    className="shrink-0 px-2 py-1 rounded-lg text-[12px] text-text-faint hover:text-text-primary hover:bg-surface-2 transition-colors"
                  >
                    {en ? 'Edit' : 'बदलें'}
                  </button>
                </div>
              ))}

              <button
                onClick={() => setEditing(blank())}
                className="w-full flex items-center gap-2.5 p-3 mt-1 rounded-2xl border border-dashed border-border text-text-muted hover:text-text-primary hover:border-border-strong transition-colors"
              >
                <Plus size={15} className="shrink-0" />
                <span className="text-[13.5px]">{en ? 'New council' : 'नई परिषद'}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-3 pt-2 pb-2 flex items-center gap-1 shrink-0 border-b border-border">
              <button
                onClick={() => setEditing(null)}
                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
                aria-label={en ? 'Back' : 'वापस'}
              >
                <ChevronLeft size={17} />
              </button>
              <input
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value.slice(0, 40) })}
                placeholder={en ? 'Name it — Business, Health…' : 'नाम दीजिए — Business, Health…'}
                className="flex-1 min-w-0 bg-transparent text-[15px] font-medium text-text-primary placeholder:text-text-faint outline-none px-1"
              />
              {councils.some(c => c.id === editing.id) && (
                <button
                  onClick={() => { onDelete(editing.id); setEditing(null); }}
                  className="p-2 rounded-lg text-text-faint hover:text-aura-red hover:bg-aura-red/10 transition-colors"
                  aria-label={en ? 'Delete council' : 'परिषद हटाएँ'}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            <div className="px-4 pt-3 pb-2 shrink-0">
              <input
                value={editing.about || ''}
                onChange={e => setEditing({ ...editing, about: e.target.value.slice(0, 200) })}
                placeholder={en ? 'What is it for? They will know.' : 'किस लिए है? उन्हें पता रहेगा।'}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-[13px] text-text-body placeholder:text-text-faint outline-none focus:border-mode-tint/50 transition-colors"
              />
              <div className="relative mt-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder={en ? 'Find someone' : 'किसी को ढूंढिए'}
                  className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-[13px] text-text-body placeholder:text-text-faint outline-none focus:border-mode-tint/50 transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-3 scrollbar-hide">
              <div className="grid sm:grid-cols-2 gap-1">
                {shown.map(name => {
                  const picked = editing.members.includes(name);
                  const { name: label, source } = displayName(name);
                  return (
                    <button
                      key={name}
                      onClick={() => toggle(name)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors ${
                        picked ? 'bg-mode-wash border-mode-tint/40' : 'border-transparent hover:bg-surface-2'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-[5px] border shrink-0 flex items-center justify-center ${
                        picked ? 'bg-mode-tint border-transparent text-on-accent' : 'border-border-strong'
                      }`}>
                        {picked && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="flex flex-col min-w-0">
                        <span className="text-[13px] text-text-primary truncate leading-tight">{label}</span>
                        {source && <span className="text-[10.5px] text-text-faint truncate leading-tight mt-0.5">{source}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-4 py-3 border-t border-border shrink-0 flex items-center gap-3">
              <span className="text-[12px] text-text-faint flex-1">
                {editing.members.length < 2
                  ? (en ? 'Pick at least two — one is a mentor, not a room.' : 'कम से कम दो चुनिए — एक अकेला कमरा नहीं होता।')
                  : `${editing.members.length} ${en ? 'in the room' : 'कमरे में'}`}
              </span>
              <button
                disabled={!canSave}
                onClick={() => { onSave({ ...editing, name: editing.name.trim() }); setEditing(null); }}
                className="px-4 py-2 rounded-xl bg-mode-tint text-on-accent text-[13px] font-medium disabled:opacity-35 transition-opacity"
              >
                {en ? 'Save' : 'सहेजें'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </>
  );
};
