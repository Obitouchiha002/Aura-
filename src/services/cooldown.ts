/**
 * When a model that just refused is worth trying again.
 *
 * Its own file, with nothing imported, because the service it came from
 * reaches Firebase on import and therefore cannot be loaded outside a
 * browser. This is the one piece of logic here that fails silently when it
 * is wrong — a refusal benched for the wrong length of time still answers,
 * it just quietly spends the day's requests on failures — so it is kept
 * somewhere a check can reach it.
 */

/**
 * How long a model that returned 429 is skipped for when nothing better is
 * known.
 *
 * This was two minutes, on the theory that a limit might lift quickly. Google's
 * quotas are mostly daily, so all that did was make roughly one message in
 * every two minutes pay for a failed round trip before it even started.
 */
export const EXHAUST_COOLDOWN = 10 * 60 * 1000;

/**
 * Google's free quota resets at midnight in California, not here.
 */
function msUntilPacificMidnight(now: Date = new Date()): number {
  const inLA = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const next = new Date(inLA);
  next.setHours(24, 0, 0, 0);
  return Math.max(next.getTime() - inLA.getTime(), 60 * 1000);
}

/**
 * How long this particular refusal is worth respecting.
 *
 * Every 429 was treated as the same event and benched for ten minutes. Google
 * issues two quite different refusals under that one number, and ten minutes
 * is wrong for both.
 *
 * A per-minute limit lifts in sixty seconds. Benching the best model in the
 * chain for ten minutes over it throws away nine minutes of the best answers
 * this app can give — and on the newest models, where the free allowance is a
 * couple of dozen requests a day, those are the requests that matter most.
 *
 * A per-day limit does not lift until midnight in California. Retrying it
 * every ten minutes costs a failed round trip each time, for the rest of the
 * day, and some of those failures are themselves counted.
 *
 * So the refusal gets read instead of counted. Google usually names the quota
 * it refused on, and often says outright how long to wait; when it says
 * neither, the old ten minutes still stands.
 */
export function cooldownFor(message: string, now: Date = new Date()): number {
  // Google says it two ways. The structured field — retryDelay: "26s" — and,
  // in the human sentence underneath, "Please retry in 39m28.12s". Both are
  // worth more than any rule we could infer: a daily quota that returns in
  // forty minutes should not be benched until midnight because the words
  // "per day" appeared in the same paragraph.
  const delay = /retry[-_ ]?delay\D{0,12}(\d+)\s*s/i.exec(message);
  if (delay) return Math.min(Number(delay[1]) + 5, 3600) * 1000;

  const human = /retry in (?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:([\d.]+)\s*s)?/i.exec(message);
  if (human && (human[1] || human[2] || human[3])) {
    const secs = Number(human[1] || 0) * 3600 + Number(human[2] || 0) * 60 + Math.ceil(Number(human[3] || 0));
    if (secs > 0) return Math.min(secs + 5, 24 * 3600) * 1000;
  }
  if (/per[\s_-]*day|perday|daily/i.test(message)) return msUntilPacificMidnight(now);
  if (/per[\s_-]*minute|perminute/i.test(message)) return 65 * 1000;
  return EXHAUST_COOLDOWN;
}
