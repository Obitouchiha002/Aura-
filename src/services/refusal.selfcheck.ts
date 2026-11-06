/**
 * Two live bugs came from the client reading the server's prose instead of its
 * facts, and nothing in the repo could have caught either one: the server's
 * sentences and the client's tests for them sat in different files, agreeing
 * by coincidence until someone reworded one.
 *
 * So this checks both halves. The classifier is checked against the exact
 * strings the server writes, and the server file is checked for the flags that
 * make the prose not matter.
 *
 *   npx tsx src/services/refusal.selfcheck.ts
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { refusalOf, refusalFrom, refuse } from './refusal';

let n = 0;
const check = (why: string, fn: () => void) => { fn(); n++; void why; };

/* ---- what the server actually says, verbatim ---- */

check('our own 401 is being signed out, flag or not', () => {
  assert.equal(refusalOf(401, { error: 'Sign in to use this.', signedOut: true }), 'signedOut');
  // An older server, no flag: the sentence still has to work.
  assert.equal(refusalOf(401, { error: 'Sign in to use this.' }), 'signedOut');
});

check('an upstream 401 is a dead key, not a signed-out person', () => {
  // This is the bug: a revoked provider key told a signed-in user to sign in,
  // and stopped the chain before the providers that still worked.
  assert.equal(refusalOf(401, { error: 'openrouter: 401 No auth credentials found' }), 'badKey');
  assert.equal(refusalOf(401, { error: 'groq: 401 Invalid API Key' }), 'badKey');
});

check('a 401 inside a number is not a 401', () => {
  // `includes('401')` matched this. It is a token-budget message.
  const said = 'groq: 413 Limit 6000, Requested 14012 tokens';
  assert.equal(refusalFrom(new Error(said)), undefined);
});

check('both of the server\'s "no key" sentences read as unconfigured', () => {
  // The provider branch's wording.
  assert.equal(
    refusalOf(503, { error: 'Cloudflare Workers AI is not configured on this server (set CLOUDFLARE_API_TOKEN).', unconfigured: true }),
    'unconfigured',
  );
  // The Gemini branch's wording. This is the one that contained no "not
  // configured" and so was never recognised, costing five round trips a
  // message forever.
  assert.equal(refusalOf(503, { error: 'Gemini is not configured on this server (set GEMINI_API_KEY).', unconfigured: true }), 'unconfigured');
  // And with the flag alone, whatever the sentence turns into next.
  assert.equal(refusalOf(503, { error: 'anything at all', unconfigured: true }), 'unconfigured');
});

check('an ordinary outage is nobody\'s special case', () => {
  assert.equal(refusalOf(503, { error: 'upstream is overloaded' }), undefined);
  assert.equal(refusalOf(500, { error: 'boom' }), undefined);
  assert.equal(refusalOf(429, { error: 'quota exceeded' }), undefined);
});

check('the reason survives being renamed on the way up', () => {
  // generateViaProvider rewrites the message to name the provider. The fact
  // has to be carried across that, or the loop is back to reading prose.
  const original = refuse('badKey', '401 Invalid API Key');
  const renamed = new Error(`openrouter: ${original.message}`) as any;
  renamed.reason = original.reason;
  assert.equal(refusalFrom(renamed), 'badKey');
});

check('a reason nobody set is not invented', () => {
  assert.equal(refusalFrom(new Error('something went wrong')), undefined);
  assert.equal(refusalFrom(undefined), undefined);
  assert.equal(refusalFrom({ reason: 'nonsense' }), undefined);
});

/* ---- the server's half of the agreement ---- */

const server = readFileSync(new URL('../../api/generate.ts', import.meta.url), 'utf8');

/**
 * Each response block, from `res.status(` to wherever the next one begins.
 * Not a regex over the braces: the provider branch builds its sentence from a
 * template literal, whose own `}` closes the match early and makes a block
 * that does carry its flag look like one that does not.
 */
function responses(code: number): string[] {
  const open = `res.status(${code}).json(`;
  const out: string[] = [];
  for (let i = server.indexOf(open); i !== -1; i = server.indexOf(open, i + 1)) {
    const next = server.indexOf('res.status(', i + open.length);
    out.push(server.slice(i, next === -1 ? i + 600 : next));
  }
  return out;
}

check('every 401 the server sends says whether it is an auth refusal', () => {
  const sends = responses(401);
  assert.ok(sends.length > 0, 'expected the server to refuse unverified callers somewhere');
  for (const s of sends) {
    assert.ok(/signedOut/.test(s), `a 401 with no signedOut flag — the chain will read it as a dead key:\n${s}`);
  }
});

check('every "no key here" 503 carries the unconfigured flag', () => {
  const sends = responses(503);
  assert.ok(sends.length >= 2, `expected the provider and Gemini branches, got ${sends.length}`);
  for (const s of sends) {
    assert.ok(/unconfigured/.test(s), `a 503 with no unconfigured flag — this model is asked again every message, forever:\n${s}`);
  }
});

console.log(`refusal: ${n} checks passed`);
