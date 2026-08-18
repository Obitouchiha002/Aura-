/**
 * The handful of things about someone that stay true between conversations.
 *
 * The rooms already remember a thread. They did not remember the person: a
 * name given on Monday was gone by Tuesday, and the mentor you had told about
 * your business asked what you did for a living. For a companion app that is
 * the difference between talking to someone and talking to a service.
 *
 * Deliberately small. This is not a transcript and not a profile — it is the
 * few durable facts a person would expect you to have kept: who they are, what
 * they are working on, what they have asked you to remember. Everything else
 * belongs to the conversation it came from.
 *
 * Stored on the device. It never goes to a server, and it is only ever read
 * into the prompt of the room the user is already talking to.
 */

const KEY = 'aura_user_memory';

/** Above this the oldest facts are dropped, so the prompt cannot creep. */
const MAX_FACTS = 24;
const MAX_FACT_LENGTH = 200;

export interface Fact {
  /** The fact itself, in the user's own words where possible. */
  text: string;
  /** When it was learned, so the oldest can go first. */
  at: number;
  /** Which room heard it. Useful when the same subject comes up elsewhere. */
  from?: string;
}

export function readMemory(): Fact[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(f => typeof f?.text === 'string') : [];
  } catch {
    return [];
  }
}

function write(facts: Fact[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(facts.slice(-MAX_FACTS))); } catch {}
}

/** Near-duplicate check, so the same fact is not stored five ways. */
function isSame(a: string, b: string): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]/g, '').trim();
  const x = norm(a), y = norm(b);
  return x === y || (x.length > 12 && (x.includes(y) || y.includes(x)));
}

export function remember(text: string, from?: string): void {
  const clean = text.trim().slice(0, MAX_FACT_LENGTH);
  if (clean.length < 3) return;
  const facts = readMemory().filter(f => !isSame(f.text, clean));
  facts.push({ text: clean, at: Date.now(), from });
  write(facts);
}

export function forget(text: string): void {
  write(readMemory().filter(f => !isSame(f.text, text)));
}

export function clearMemory(): void {
  try { localStorage.removeItem(KEY); } catch {}
}

/**
 * The memory as prompt text, or nothing when there is none.
 *
 * Phrased as things already known rather than as instructions, so a character
 * uses them the way anyone uses what they remember about a person — in
 * passing, when relevant — instead of reciting them back.
 */
export function memoryPrompt(): string {
  const facts = readMemory();
  if (!facts.length) return '';
  return `
WHAT YOU ALREADY KNOW ABOUT THIS PERSON
${facts.map(f => `- ${f.text}`).join('\n')}
Use these the way you would use anything you remember about someone: only when
it is relevant, never as a list, and never announced. Do not ask about
something you have been told here. If one of them appears to have changed, go
with what they are saying now.`;
}

/**
 * Pulls durable facts out of a message.
 *
 * Kept to plain patterns on purpose. Sending every message to a model to decide
 * what is worth remembering would double the cost of a conversation and add a
 * second place for the app to be wrong about someone. These catch the things
 * people actually state outright — a name, a job, a city, or an explicit "yaad
 * rakhna" — and everything else is simply left in the conversation where it
 * was said.
 */
/**
 * Trims the grammar that a capture drags along with it.
 *
 * Hinglish puts the copula at the end — "meri company ABC hai" — so a naive
 * capture stores "ABC hai", and the connective after "yaad rakhna" leaves a
 * stray "ki" at the front. Both read as broken when a character repeats them.
 */
function tidy(text: string): string {
  return text
    .trim()
    .replace(/^(?:ki|that|k)\s+/i, '')
    .replace(/\s+(?:hai|hain|hoon|hu|hun|h|tha|thi|he)[\s.,!]*$/i, '')
    .replace(/[\s.,!]+$/, '')
    .trim();
}

/**
 * Order matters. The specific readings run first, or "main Delhi me rehta
 * hoon" is caught by the generic "main … hoon" rule and stored as an
 * occupation called "Delhi me rehta".
 */
const PATTERNS: Array<{ re: RegExp; as: (m: RegExpMatchArray) => string }> = [
  // An explicit request always wins.
  { re: /(?:yaad rakh(?:na|o|iye)|remember that|remember|note kar(?:na|lo))\s*[:,-]?\s*(.{4,180})/i,
    // A whole sentence, so only the leading connective goes. Stripping the
    // verb here would leave "mujhe subah 6 baje uthna".
    as: m => m[1].trim().replace(/^(?:ki|that|k)\s+/i, '').replace(/[\s.,!]+$/, '') },

  { re: /\b(?:mera naam|my name is)\s+([A-Za-zऀ-ॿ][\wऀ-ॿ'.-]{1,28})/i,
    as: m => `Their name is ${tidy(m[1])}` },

  // "I live in Delhi" — the place follows the verb.
  { re: /\b(?:i)\s+(?:live in|am based in|am from)\s+([\wऀ-ॿ .'-]{2,30})/i,
    as: m => `They live in ${tidy(m[1])}` },

  // "main Delhi me rehta hoon" — in Hinglish it comes before it.
  { re: /\b(?:mai|main|mein)\s+([\wऀ-ॿ .'-]{2,30}?)\s*(?:me|mein|se)?\s*(?:rehta|rehti)\s+(?:hoon|hu|hun|h)\b/i,
    as: m => `They live in ${tidy(m[1])}` },

  { re: /\b(?:i)\s+(?:study|am studying)\s+([\wऀ-ॿ .'-]{2,40})/i,
    as: m => `They study ${tidy(m[1])}` },

  { re: /\b(?:mai|main|mein)\s+([\wऀ-ॿ .'-]{2,40}?)\s*(?:padhta|padhti)\s+(?:hoon|hu|hun|h)\b/i,
    as: m => `They study ${tidy(m[1])}` },

  { re: /\b(?:meri company|my company|mera business|my business|meri startup|mera startup)\s+(?:ka naam\s+)?(?:is\s+)?([\wऀ-ॿ .&'-]{2,40})/i,
    as: m => `Their company is ${tidy(m[1])}` },

  // The generic occupation reading, last, and only when it is not one of the
  // readings above wearing the same shape.
  { re: /\b(?:mai|main|mein|i)\s+(?:ek\s+)?((?!.*(?:rehta|rehti|padhta|padhti|jaa|kar raha|kar rahi))[a-zA-Zऀ-ॿ ]{3,28}?)\s*(?:hoon|hu|hun|am a|am an)\b/i,
    as: m => `They are a ${tidy(m[1])}` },
];

/** Reads a user message and stores anything durable it states. */
export function learnFrom(message: string, room?: string): void {
  if (!message || message.length > 2000) return;
  for (const { re, as } of PATTERNS) {
    const m = message.match(re);
    if (m) {
      const fact = as(m);
      if (fact && fact.length >= 4) remember(fact, room);
    }
  }
}
