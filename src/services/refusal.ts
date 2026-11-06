/**
 * Why a provider said no — as a fact, not as a sentence.
 *
 * The chain used to work this out by reading the error's prose, and both
 * readings it made were wrong.
 *
 * It asked `message.includes('401')`, meaning "our endpoint says you are not
 * signed in". But every upstream provider also answers 401 when its own key
 * has expired — routine for free-tier keys — and the chain then told a
 * signed-in person they were signed out and stopped, leaving five working
 * providers untried. The same test matched the `401` sitting inside
 * "Limit 6000, Requested 14012 tokens", which is not an auth problem at all.
 *
 * It asked `message.includes('not configured')` to spot a provider with no
 * key, so it could stop asking that one for the rest of the session. The
 * server's Gemini branch happened to say "No Gemini key configured on the
 * server" — which does not contain that substring — so on a deployment with
 * no Gemini key, five models were struck off nothing and cost five round
 * trips on every message, forever.
 *
 * Prose is for the person reading it. The server already knows which of these
 * happened and can simply say so, in a field. This module is the agreement
 * about that field, kept where both sides can see it and a check can run
 * against it — with the old prose still honoured, because a browser holding a
 * cached bundle will go on talking to the new server for a while.
 *
 * Its own file, with nothing imported, so the part that decides can be tested
 * outside a browser.
 */

export type Refusal =
  /** Our own endpoint turned away a caller it could not verify. */
  | 'signedOut'
  /** This provider has no key on this deployment. Nothing to do but skip it. */
  | 'unconfigured'
  /** This provider has a key and the provider rejected it. Expired or revoked. */
  | 'badKey';

/** What the server sends back alongside the sentence. */
export interface RefusalBody {
  error?: string;
  signedOut?: boolean;
  unconfigured?: boolean;
}

/**
 * What a response from our own endpoint means.
 *
 * `undefined` is the ordinary case: something failed, and it is the chain's
 * business to try the next one and report what it finds.
 */
export function refusalOf(status: number, body: RefusalBody = {}): Refusal | undefined {
  const said = body?.error || '';

  if (status === 401) {
    // The flag is the answer; the sentence is the fallback for a client that
    // reaches a server older than this agreement.
    if (body?.signedOut || /sign in to use this/i.test(said)) return 'signedOut';
    // Any other 401 came from upstream, with our key, and is about that key.
    return 'badKey';
  }

  if (status === 503) {
    if (body?.unconfigured || /not configured/i.test(said)) return 'unconfigured';
    return undefined;
  }

  return undefined;
}

/** Build an error that carries its reason to whoever catches it. */
export function refuse(reason: Refusal, message: string): Error & { reason: Refusal } {
  const e = new Error(message) as Error & { reason: Refusal };
  e.reason = reason;
  return e;
}

const REASONS: Refusal[] = ['signedOut', 'unconfigured', 'badKey'];

/**
 * Read the reason back off an error the chain is holding.
 *
 * Errors get renamed on the way up — the provider's name is prepended so the
 * log says which one went — so the reason has to be carried deliberately
 * rather than re-derived from the text. Where it was not carried, the two
 * phrases the server actually writes are still recognised; a bare "401"
 * anywhere in the text is deliberately not, which is the bug this replaces.
 */
export function refusalFrom(error: any): Refusal | undefined {
  if (error && REASONS.includes(error.reason)) return error.reason;
  const said = String(error?.message || '');
  if (/sign in to use this/i.test(said)) return 'signedOut';
  if (/not configured/i.test(said)) return 'unconfigured';
  return undefined;
}
