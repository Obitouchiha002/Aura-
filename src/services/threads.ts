/**
 * What this person has been talking about, before today.
 *
 * Its own file, with nothing imported, so the part that decides what is
 * relevant can actually be checked — the service that uses it reaches Firebase
 * on import and cannot be loaded outside a browser.
 *
 * The first version of this sent the eight most recent threads, by title, into
 * every request. That was continuity of a sort, and it had two faults that only
 * showed up once someone used the app for real.
 *
 * It told the model the subject came up and nothing else. "Business ka faisla"
 * is the first thirty characters of a message from three weeks ago; whoever is
 * answering knows a decision was discussed and has no idea what was decided,
 * so the person has to explain themselves again, which is the exact thing
 * having a memory was supposed to prevent.
 *
 * And it sent all eight regardless of what was being asked. Someone with
 * threads about a business, a sleep problem, a chapter of physics and an
 * argument with their brother got all four pushed into a conversation about
 * one of them. A mentor holding four unrelated lives in mind answers like
 * someone who has confused you with another client.
 *
 * So: a short gist of how each thread actually went, and only the threads that
 * have something to do with what was just said — plus the two most recent
 * whatever happens, because "what have you been up to" has no keywords in it
 * and is still a thing people say.
 */

export interface PastThread {
  title: string;
  mode: string;
  character?: string;
  updatedAt: number;
  /** How the thread actually went — the last exchange, trimmed. */
  gist?: string;
}

const ROOM_LABEL: Record<string, string> = {
  COUNCIL: 'the Council', MENTOR: 'the Mentor', PSYCHOLOGY: 'the Psychologist',
  TEACHER: 'the Teacher', EMOTION: 'the Poets',
};

export function whenish(at: number, now: number = Date.now()): string {
  const days = Math.floor((now - at) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/**
 * Words that appear in every thread and therefore distinguish none of them.
 *
 * Hinglish as well as English, because the app is mostly used in it and
 * "mujhe", "karna" and "hai" would otherwise match everything ever written.
 */
const NOISE = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'what', 'you', 'your', 'our',
  'are', 'was', 'were', 'have', 'has', 'had', 'but', 'not', 'can', 'will',
  'about', 'from', 'they', 'them', 'his', 'her', 'she', 'him', 'who', 'how',
  'why', 'when', 'where', 'all', 'any', 'one', 'out', 'get', 'got', 'should',
  'would', 'could', 'just', 'like', 'into', 'than', 'then', 'there', 'their',
  'main', 'mera', 'meri', 'mere', 'mujhe', 'muje', 'tum', 'tumhara', 'aap',
  'hai', 'hain', 'tha', 'thi', 'the', 'kya', 'kyun', 'kaise', 'karna', 'karo',
  'kar', 'nahi', 'nhi', 'bhi', 'ko', 'ka', 'ki', 'ke', 'se', 'me', 'mein',
  'par', 'abhi', 'bol', 'bolo', 'batao', 'raha', 'rahi', 'rha', 'hoon', 'hu',
]);

/** The words in a piece of text worth matching on. */
function keywords(text: string): Set<string> {
  return new Set(
    (text || '')
      .toLowerCase()
      .split(/[^a-z0-9ऀ-ॿ]+/)
      .filter(w => w.length > 2 && !NOISE.has(w)),
  );
}

/**
 * Which past threads belong in this conversation.
 *
 * Scored rather than filtered, because the question is not whether a thread is
 * related but which are the most related — and a thread about the same subject
 * three weeks ago beats an unrelated one from this morning.
 *
 *   overlap   shared words between what was just said and the thread
 *   same      the same mentor, when this is a Mentor conversation: continuing
 *             a conversation with one person is a different thing from
 *             remembering a subject
 *   recency   a small thumb on the scale, never enough to outweigh a match
 *
 * The two most recent always come through, scored or not. Someone opening with
 * "kaisa chal raha hai" has given nothing to match on and still deserves to be
 * recognised.
 */
export function pickRelevant(
  threads: PastThread[],
  said: string,
  mode?: string,
  character?: string,
  limit = 5,
): PastThread[] {
  const usable = threads
    .filter(t => t?.title && t?.updatedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  if (!usable.length) return [];

  const asked = keywords(said);
  const newest = usable.slice(0, 2);

  const scored = usable.map(t => {
    const words = keywords(`${t.title} ${t.gist || ''}`);
    let overlap = 0;
    for (const w of asked) if (words.has(w)) overlap++;

    const same = mode === 'MENTOR' && character && t.character === character ? 1.5 : 0;
    // Half a point for today, tailing off over a month — enough to order two
    // equally relevant threads, never enough to promote an unrelated one.
    const recency = Math.max(0, 0.5 - (Date.now() - t.updatedAt) / (30 * 86_400_000));
    return { t, score: overlap * 2 + same + recency };
  });

  const picked = scored
    .filter(x => x.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.t);

  for (const t of newest) if (!picked.includes(t)) picked.push(t);

  return picked.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit + 2);
}

export function threadsPrompt(
  threads: PastThread[] = [],
  said = '',
  mode?: string,
  character?: string,
): string {
  const recent = pickRelevant(threads, said, mode, character);
  if (!recent.length) return '';

  const lines = recent.map(t => {
    const where = t.mode === 'MENTOR' && t.character ? t.character : (ROOM_LABEL[t.mode] || 'a room');
    const head = `- "${t.title}" — with ${where}, ${whenish(t.updatedAt)}`;
    return t.gist ? `${head}\n  Where it got to: ${t.gist}` : head;
  });

  const mine = mode === 'MENTOR' && character
    ? `\nSome of these were with you. Those you remember as your own conversations with this person — not as notes you have read, but as things that were said to you.`
    : '';

  return `
WHAT THEY HAVE BEEN TALKING ABOUT
This is not their first conversation here. These are the threads of theirs that
bear on what they have just said, each with the line they opened it with and
where it got to:
${lines.join('\n')}${mine}
Use this the way you use knowing someone. If what they say now follows from one
of these, treat it as continuing rather than starting — do not make them explain
their situation to you again, and do not ask what you were already told. You may
ask how a thing went, once, when it is genuinely what this reminds you of.
Never list these back at them, never say you have been reading their history,
and never invent the part you were not given.`;
}

/**
 * Where a thread got to, in one line.
 *
 * The last thing the room said, because that is the thing a person would
 * remember about a conversation they had three weeks ago — not how it opened,
 * which the title already carries, but what it came to.
 *
 * Built here rather than asked of a model: a summary per thread per message
 * would be a second request for every reply, and the quota is the thing this
 * app runs out of first.
 */
export function gistOf(messages?: { text?: string; isAi?: boolean }[]): string | undefined {
  if (!messages?.length) return undefined;

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m?.isAi || !m.text) continue;

    const plain = m.text
      // The room's private argument is not where the thread got to.
      .replace(/```room[\s\S]*?```/g, ' ')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/^\[[^\]]{2,40}\]\s*/, '')   // the speaker's name
      .replace(/[*_#>`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (plain.length < 20) continue;

    if (plain.length <= 220) return plain;
    const cut = plain.slice(0, 220);
    const stop = cut.lastIndexOf(' ');
    return `${stop > 120 ? cut.slice(0, stop) : cut}…`;
  }
  return undefined;
}
