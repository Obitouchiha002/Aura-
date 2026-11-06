/**
 * A project that leaks is not a project. If the scope filter is wrong, the
 * business room quietly starts answering with last week's argument about
 * someone's brother — which is the exact thing it exists to prevent, and it
 * fails without an error.
 *
 *   npx tsx src/services/councils.selfcheck.ts
 */
import assert from 'node:assert';
import { scopeToCouncil, newCouncilId, isCouncilId, councilPrompt, HOUSE } from './councils';

const threads = [
  { title: 'pricing', mode: 'COUNCIL', character: 'cx_biz' },
  { title: 'launch', mode: 'COUNCIL', character: 'cx_biz' },
  { title: 'bhai se jhagda', mode: 'COUNCIL', character: undefined },
  { title: 'a poem', mode: 'EMOTION', character: 'Mirza Ghalib' },
  { title: 'with Tywin', mode: 'MENTOR', character: 'Tywin Lannister' },
];

// Inside a project: its own threads, plus whatever other rooms hold.
const biz = scopeToCouncil(threads, 'COUNCIL', 'cx_biz');
assert.deepStrictEqual(
  biz.map(t => t.title),
  ['pricing', 'launch', 'a poem', 'with Tywin'],
  'a project must see its own Council threads and no other project\'s',
);

// The house council does not get the project's either — isolation runs both ways.
const house = scopeToCouncil(threads, 'COUNCIL', HOUSE);
assert.deepStrictEqual(house.map(t => t.title), ['bhai se jhagda', 'a poem', 'with Tywin']);

// A mentor still remembers everything they were told.
assert.strictEqual(scopeToCouncil(threads, 'MENTOR', 'cx_biz').length, threads.length);

// An id must never be mistakable for a character's name.
const id = newCouncilId(1, 0.5);
assert.ok(isCouncilId(id), `${id} is not recognisable as a council`);
assert.ok(!isCouncilId('Tywin Lannister'));
assert.ok(!isCouncilId(''));
assert.notStrictEqual(newCouncilId(1, 0.1), newCouncilId(1, 0.9));

// No council, no extra instruction — the house room must read as it always did.
assert.strictEqual(councilPrompt(undefined), '');
const p = councilPrompt({ id: 'cx_1', name: 'Business', about: 'the app', members: ['a', 'b'], createdAt: 0 });
assert.ok(p.includes('Business') && p.includes('the app'), 'the prompt lost the project');

console.log('councils: 9 checks passed');
