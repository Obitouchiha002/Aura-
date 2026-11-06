/**
 * What the model is told about someone's past is the one thing here that is
 * wrong invisibly: too much and the mentor confuses four lives, too little and
 * it asks a question it was already answered. Neither shows up as an error.
 *
 *   npx tsx src/services/threads.selfcheck.ts
 */
import assert from 'node:assert';
import { pickRelevant, gistOf, threadsPrompt, type PastThread } from './threads';

const day = 86_400_000;
const now = Date.now();

const threads: PastThread[] = [
  { title: 'Neend nahi aa rahi', mode: 'PSYCHOLOGY', updatedAt: now - day, gist: 'Screen band karke dekhna.' },
  { title: 'Physics ka chapter samjhao', mode: 'TEACHER', updatedAt: now - 2 * day },
  { title: 'Business ka faisla', mode: 'MENTOR', character: 'Tywin Lannister', updatedAt: now - 20 * day, gist: 'Offer lene se pehle leverage banao.' },
  { title: 'Bhai se jhagda', mode: 'MENTOR', character: 'Thomas Shelby', updatedAt: now - 25 * day },
  { title: 'App ki marketing', mode: 'COUNCIL', updatedAt: now - 30 * day, gist: 'Pehle ye dekho kaun already khareed raha hai.' },
];

// The subject wins over the clock: a business thread from three weeks ago must
// beat a sleep thread from yesterday when the question is about business.
const business = pickRelevant(threads, 'us business wale offer ka kya karun', 'MENTOR', 'Tywin Lannister');
assert.ok(business.some(t => t.title === 'Business ka faisla'), 'the related thread was not picked');
assert.ok(
  business.indexOf(business.find(t => t.title === 'Business ka faisla')!) <
  business.length,
  'related thread missing',
);

// Nothing to match on is still a conversation with someone you know.
const vague = pickRelevant(threads, 'aur batao', 'MENTOR', 'Thomas Shelby');
assert.ok(vague.length >= 2, 'the two most recent must come through regardless');

// An unrelated question must not drag everything in.
const narrow = pickRelevant(threads, 'neend ka kya karun');
assert.ok(narrow.length <= 7, `too many threads: ${narrow.length}`);

// No history is no section — never an empty heading.
assert.strictEqual(threadsPrompt([], 'anything'), '');

// The gist is the last thing the room said, with its private argument left out.
assert.strictEqual(
  gistOf([
    { text: 'kya karun', isAi: false },
    { text: '[Tywin Lannister] Wait for the offer to come to you.\n```room\nShelby: He needs paying.\n```', isAi: true },
  ]),
  'Tywin Lannister Wait for the offer to come to you.'.replace('Tywin Lannister ', ''),
);
assert.strictEqual(gistOf([]), undefined);
assert.strictEqual(gistOf([{ text: 'hi', isAi: false }]), undefined);

console.log('threads: 7 checks passed');
