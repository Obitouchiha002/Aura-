import React, { useState } from 'react';
import { Brain, X } from 'lucide-react';
import { readMemory, forget, clearMemory } from '../utils/userMemory';

/**
 * What the app has kept about you, and a way to take it back.
 *
 * Memory that cannot be inspected is memory you have to trust blindly, and in
 * a companion app the things remembered are personal by definition. Everything
 * here is stored on the device and never sent anywhere except into the prompt
 * of the room already being talked to.
 */
export const MemoryRow: React.FC<{ Row: React.ComponentType<any> }> = ({ Row }) => {
  const [open, setOpen] = useState(false);
  const [facts, setFacts] = useState(() => readMemory());

  const drop = (text: string) => { forget(text); setFacts(readMemory()); };
  const wipe = () => { clearMemory(); setFacts([]); };

  return (
    <>
      <Row
        icon={Brain}
        label="Yaad rakhi baatein"
        hint={facts.length ? `${facts.length} cheezein — phone par hi` : 'Abhi kuch nahi'}
        onClick={() => { setFacts(readMemory()); setOpen(true); }}
      />

      {open && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-scrim" onClick={() => setOpen(false)} />
          <div className="relative bg-bg border-t sm:border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-float max-h-[88dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-[15px] font-semibold text-text-primary">Yaad rakhi baatein</h2>
              <button onClick={() => setOpen(false)} className="p-2 text-text-muted" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-3 space-y-2">
              {facts.length === 0 ? (
                <p className="text-[13px] text-text-muted py-6 text-center">
                  Abhi kuch yaad nahi. Jo aap khud batayenge — naam, kaam, ya "yaad rakhna …" —
                  wahi yahan aayega.
                </p>
              ) : (
                facts.map(f => (
                  <div key={f.text} className="flex items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
                    <span className="flex-1 text-[13.5px] text-text-body">{f.text}</span>
                    <button
                      onClick={() => drop(f.text)}
                      className="shrink-0 text-text-faint p-1"
                      aria-label="Bhool jao"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {facts.length > 0 && (
              <div className="px-4 py-3 border-t border-border">
                <button
                  onClick={wipe}
                  className="w-full rounded-full border border-border py-2.5 text-[13px] text-aura-red"
                >
                  Sab bhool jao
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
