/**
 * One runnable check for the only piece of logic here that can be silently
 * wrong: a quota refusal benched for the wrong length of time still works,
 * it just quietly wastes the day's requests. Run with:
 *
 *   npx tsx src/services/cooldown.selfcheck.ts
 */
import assert from 'node:assert';
import { cooldownFor } from './cooldown';

// What Google actually sends back, in the three shapes that matter.
const perMinute = '429 RESOURCE_EXHAUSTED: Quota exceeded for quota metric ' +
  'generate_requests_per_model_per_minute';
const perDay = '429 You exceeded your current quota. quotaId: ' +
  'GenerateRequestsPerDayPerProjectPerModel-FreeTier';
const withDelay = '429 RESOURCE_EXHAUSTED ... "retryDelay": "26s"';
const vague = '429 Too Many Requests';

const s = (ms: number) => Math.round(ms / 1000);

// A minute limit lifts in a minute. Benching the best model longer than that
// is the whole bug.
assert.strictEqual(s(cooldownFor(perMinute)), 65);

// A day limit does not lift until midnight in California — never 10 minutes,
// never more than 24 hours.
const day = cooldownFor(perDay);
assert.ok(day > 60 * 1000 && day <= 24 * 3600 * 1000, `day cooldown out of range: ${s(day)}s`);

// When Google says how long to wait, that wins over any guess.
assert.strictEqual(s(cooldownFor(withDelay)), 31);

// Told nothing, fall back to what the app did before.
assert.strictEqual(s(cooldownFor(vague)), 600);

console.log('cooldownFor: 4 checks passed');
