import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Plus, Trash2, ChevronLeft, Search, X } from 'lucide-react';
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
 * to be in, and deciding who sits in it.
 *
 * The builder is a table and a corridor. People are dragged from the corridor
 * to the table, or tapped, and the same gesture in reverse sends them out. It
 * is dragging rather than a column of checkboxes because the thing being built
 * is a room with people in it, and a list of ticks is a form — you cannot see
 * who is in the room by reading a form.
 *
 * Dragging is motion's, not HTML5's: HTML5 drag events do not exist on touch,
 * and this is used on a phone. Tapping does the same job for anyone who would
 * rather not drag, and `layoutId` animates the move either way, so the person
 * visibly crosses from one place to the other.
 */
/**
 * One person, in the corridor or at the table.
 *
 * At module scope and memoised, which is not a refinement — it is the whole
 * bug. Defined inside the sheet, this was a new component *type* on every
 * render, so React could not match it to the one before: typing a single
 * character into the council's name unmounted all twenty-five people and
 * mounted them again, which lost the scroll position and replayed every
 * animation. The list jumped under the finger on every keystroke.
 *
 * `onToggle` takes the name rather than closing over it, so the callback is
 * stable and the memo can actually hold.
 */
const Person = React.memo(function Person({
  name, inRoom, onToggle, onOver, isOverTable, displayName, initials,
}: {
  name: string;
  inRoom: boolean;
  onToggle: (name: string) => void;
  onOver: (over: boolean) => void;
  isOverTable: (x: number, y: number) => boolean;
  displayName: (c: string) => { name: string; source?: string };
  initials: (c: string) => string;
}) {
  const { name: label, source } = displayName(name);
  return (
    <motion.div
      layoutId={`person-${name}`}
      layout="position"
      drag
      dragSnapToOrigin
      dragElastic={0.12}
      whileDrag={{ scale: 1.06, zIndex: 60 }}
      onDrag={(_, info) => { if (!inRoom) onOver(isOverTable(info.point.x, info.point.y)); }}
      onDragEnd={(_, info) => {
        onOver(false);
        const onTable = isOverTable(info.point.x, info.point.y);
        if (inRoom !== onTable) onToggle(name);
      }}
      onClick={() => onToggle(name)}
      transition={{ type: 'spring', stiffness: 520, damping: 38 }}
      className={`flex items-center gap-2 rounded-xl border text-left select-none touch-none cursor-grab active:cursor-grabbing ${
        inRoom
          ? 'bg-mode-wash border-mode-tint/40 pl-1.5 pr-2 py-1.5'
          : 'bg-surface border-border hover:border-border-strong p-2'
      }`}
    >
      <span className={`relative overflow-hidden rounded-full flex items-center justify-center font-bold shrink-0 ${
        inRoom ? 'w-6 h-6 text-[9.5px] bg-mode-tint text-on-accent' : 'w-7 h-7 text-[10px] bg-surface-2 text-text-muted'
      }`}>
        {initials(name)}
      </span>
      <span className="flex flex-col min-w-0">
        <span className={`truncate leading-tight ${inRoom ? 'text-[12px] text-mode-tint font-medium' : 'text-[12.5px] text-text-primary'}`}>
          {label}
        </span>
        {!inRoom && source && (
          <span className="text-[10px] text-text-faint truncate leading-tight mt-0.5">{source}</span>
        )}
      </span>
      {inRoom && <X size={12} className="text-mode-tint/60 shrink-0" />}
    </motion.div>
  );
});

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
  initials: (c: string) => string;
}> = ({ lang, roster, councils, current, onPick, onSave, onDelete, onClose, displayName, initials }) => {
  const en = lang === 'en';
  const [editing, setEditing] = useState<Council | null>(null);
  const [q, setQ] = useState('');
  const [over, setOver] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const blank = (): Council => ({
    id: newCouncilId(), name: '', about: '', members: [], createdAt: Date.now(),
  });

  const seat = useCallback((name: string) => {
    setEditing(e => (e && !e.members.includes(name) ? { ...e, members: [...e.members, name] } : e));
  }, []);

  const unseat = useCallback((name: string) => {
    setEditing(e => (e ? { ...e, members: e.members.filter(m => m !== name) } : e));
  }, []);

  /** Did this gesture finish over the table? */
  const isOverTable = useCallback((x: number, y: number) => {
    const r = tableRef.current?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }, []);

  const markOver = useCallback((v: boolean) => setOver(o => (o === v ? o : v)), []);

  const seated = editing?.members ?? [];
  const available = roster
    .filter(c => !seated.includes(c))
    .filter(c => c.toLowerCase().includes(q.trim().toLowerCase()));

  // Two is a room. One is a mentor with extra steps, and the prompt falls back
  // to the house council below that, so letting one be saved would be a lie
  // told by the interface.
  const canSave = !!editing && editing.name.trim().length > 0 && seated.length >= 2;

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-scrim" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        /*
          The height subtracts the keyboard.

          The first version put Save in a footer below the roster and pinned
          the sheet to the bottom of the screen. Typing the council's name
          opens the keyboard, the keyboard takes the bottom of the screen, and
          the button a person had just earned the right to press was underneath
          it. Save moved to the top bar, where nothing can cover it, and the
          sheet keeps its distance from the keyboard besides.
        */
        className="fixed z-[95] inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:top-16 sm:left-1/2 sm:-translate-x-1/2 sm:w-[32rem] flex flex-col bg-elevated border border-border rounded-t-3xl sm:rounded-3xl shadow-float overflow-hidden"
        style={{ maxHeight: 'calc(88vh - var(--kb-inset, 0px))' }}
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

            <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] scrollbar-hide">
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
                  className={`w-full flex items-center gap-2 p-3 rounded-2xl border transition-colors ${
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
            {/* Save lives up here. Nothing can cover the top of a sheet. */}
            <div className="px-2 py-2 flex items-center gap-1 shrink-0 border-b border-border">
              <button
                onClick={() => setEditing(null)}
                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors shrink-0"
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
                  className="p-2 rounded-lg text-text-faint hover:text-aura-red hover:bg-aura-red/10 transition-colors shrink-0"
                  aria-label={en ? 'Delete council' : 'परिषद हटाएँ'}
                >
                  <Trash2 size={15} />
                </button>
              )}
              <button
                disabled={!canSave}
                onClick={() => { onSave({ ...editing, name: editing.name.trim() }); setEditing(null); }}
                className="shrink-0 px-3.5 py-1.5 rounded-xl bg-mode-tint text-on-accent text-[13px] font-medium disabled:opacity-30 transition-opacity"
              >
                {en ? 'Save' : 'सहेजें'}
              </button>
            </div>

            {/* The table */}
            <div className="px-4 pt-3 shrink-0">
              <motion.div
                ref={tableRef}
                animate={{
                  borderColor: over ? 'var(--color-mode-tint)' : 'var(--border-color)',
                  backgroundColor: over ? 'var(--color-mode-wash)' : 'transparent',
                }}
                transition={{ duration: 0.15 }}
                className="rounded-2xl border border-dashed p-2.5 min-h-[5.5rem]"
              >
                {seated.length === 0 ? (
                  <p className="text-[12.5px] text-text-faint text-center py-5 leading-snug px-4">
                    {en
                      ? 'Drag someone up here, or tap them. Two makes a room.'
                      : 'किसी को यहाँ खींच लाइए, या टैप कीजिए। दो से कमरा बनता है।'}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <AnimatePresence mode="popLayout">
                      {seated.map(name => (
                        <Person key={name} name={name} inRoom onToggle={unseat} onOver={markOver}
                          isOverTable={isOverTable} displayName={displayName} initials={initials} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>

              {/* Why Save is grey. The button being disabled is not an
                  explanation, and "it would not click" is what a person
                  reports when the interface declined to say what it wanted. */}
              {!canSave && (
                <p className="text-[11.5px] text-text-faint mt-2 px-0.5">
                  {!editing.name.trim()
                    ? (en ? 'Give it a name to save it.' : 'सहेजने के लिए नाम दीजिए।')
                    : (en
                        ? `One more at least — ${seated.length} of 2.`
                        : `कम से कम एक और — ${seated.length}/2।`)}
                </p>
              )}

              <input
                value={editing.about || ''}
                onChange={e => setEditing({ ...editing, about: e.target.value.slice(0, 200) })}
                placeholder={en ? 'What is it for? They will know.' : 'किस लिए है? उन्हें पता रहेगा।'}
                className="w-full mt-2.5 bg-surface border border-border rounded-xl px-3 py-2 text-[13px] text-text-body placeholder:text-text-faint outline-none focus:border-mode-tint/50 transition-colors"
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

            {/* The corridor */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] scrollbar-hide">
              <div className="grid grid-cols-2 gap-1.5">
                <AnimatePresence mode="popLayout">
                  {available.map(name => (
                    <Person key={name} name={name} inRoom={false} onToggle={seat} onOver={markOver}
                      isOverTable={isOverTable} displayName={displayName} initials={initials} />
                  ))}
                </AnimatePresence>
              </div>
              {available.length === 0 && (
                <p className="text-center text-[12.5px] text-text-faint py-8">
                  {q ? (en ? 'No one by that name.' : 'इस नाम का कोई नहीं।')
                     : (en ? 'Everybody is in the room.' : 'सब कमरे में हैं।')}
                </p>
              )}
            </div>
          </>
        )}
      </motion.div>
    </>
  );
};
