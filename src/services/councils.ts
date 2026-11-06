/**
 * Councils you assemble yourself.
 *
 * The Council is twenty-five people and it answers everything, which is the
 * right shape for "what should I do about this" and the wrong one for a thing
 * you are going to come back to for six months. Someone building a business
 * does not want Ghalib's opinion on their pricing, and — more to the point —
 * does not want last week's argument about their brother surfacing in the
 * middle of it.
 *
 * So a council can be made: a name, a line about what it is for, and the
 * people in it. It behaves like a room of its own. Threads opened inside one
 * stay inside it, and the house council never sees them either.
 *
 * It rides on the slot the Mentor already uses. A session records which
 * character it was with; for the Council that field was always empty, and it
 * now carries the council's id. Which means sessions, history, the thread
 * picker and the Firestore documents all learned this feature by not changing
 * at all.
 *
 * Kept in localStorage rather than Firestore: it is a handful of short strings,
 * it must work with no network, and nothing here is worth a rules migration.
 *
 * Its own file, with nothing imported, so the parts that can be quietly wrong
 * are reachable by a check.
 */

export interface Council {
  id: string;
  name: string;
  /** What this council is for, in the user's words. Goes into the prompt. */
  about?: string;
  /** Roster names, exactly as the profiles spell them. */
  members: string[];
  createdAt: number;
}

const KEY = 'aura_councils';

/** The house council — everyone, no project. Its id is the empty string. */
export const HOUSE = '';

export function loadCouncils(): Council[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(c => c && typeof c.id === 'string' && typeof c.name === 'string')
      .map(c => ({
        id: c.id,
        name: String(c.name).slice(0, 40),
        about: typeof c.about === 'string' ? c.about.slice(0, 400) : undefined,
        members: Array.isArray(c.members) ? c.members.filter((m: any) => typeof m === 'string') : [],
        createdAt: Number(c.createdAt) || Date.now(),
      }));
  } catch {
    return [];
  }
}

export function saveCouncils(list: Council[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* A full or blocked store is not worth losing the conversation over. */
  }
}

export function councilById(list: Council[], id?: string): Council | undefined {
  if (!id) return undefined;
  return list.find(c => c.id === id);
}

/**
 * An id that will not collide with a character's name.
 *
 * It shares a field with the Mentor's character, so it has to be
 * distinguishable from one — a council called "Tywin Lannister" must not
 * become Tywin Lannister.
 */
export function newCouncilId(now: number = Date.now(), rand: number = Math.random()): string {
  return `cx_${now.toString(36)}${Math.floor(rand * 1e6).toString(36)}`;
}

export function isCouncilId(value?: string): boolean {
  return !!value && value.startsWith('cx_');
}

/**
 * The threads that belong to this council and no other.
 *
 * The whole promise of a project is that its conversations do not mix, so this
 * is a filter rather than a ranking: a business council sees business threads
 * and nothing else, and the house council does not see any project's.
 *
 * Outside the Council room it does nothing — a mentor should still remember
 * everything they were told.
 */
export function scopeToCouncil<T extends { mode: string; character?: string }>(
  threads: T[],
  mode: string,
  councilId?: string,
): T[] {
  if (mode !== 'COUNCIL') return threads;
  const want = councilId || HOUSE;
  return threads.filter(t => t.mode !== 'COUNCIL' || (t.character || HOUSE) === want);
}

/**
 * What a made council adds to the Council's instruction.
 *
 * Only the two things the house version cannot know: that this is one subject
 * returned to over time, and what the subject is.
 */
export function councilPrompt(council?: Council): string {
  if (!council) return '';
  const about = council.about?.trim();
  return `

THIS ROOM IN PARTICULAR
- This is "${council.name}" — a standing room the person assembled themselves, for one part of their life, which they come back to. ${about ? `In their own words, it is for: ${about}` : 'They have not said what it is for; work it out from what they bring.'}
- The people above are the ones they chose for it. Nobody else is in the building.
- Everything said here belongs to this subject. Do not reach for their other conversations, and do not widen the question into their life in general — they opened this room precisely so that would not happen.`;
}
