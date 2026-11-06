/**
 * Which providers are tried after Gemini.
 *
 * Its own file, with nothing imported, for the same reason cooldown.ts is:
 * the service it came from reaches Firebase on import and cannot be loaded
 * outside a browser, and this list has to be checkable against the server's
 * table. A name here that the server has no row for is a round trip spent on
 * a 400 that retrying will never fix.
 */

/**
 * Groq's place in the model chain.
 *
 * Not a Gemini model name, so the loop hands it to the Groq path instead. It
 * sits in the list rather than behind a special case, which is the whole point:
 * it is now reached whenever the models before it fail, for any reason.
 */
export const GROQ = 'groq';

/**
 * The providers tried after Gemini, in order, when its quota is gone.
 *
 * Not seven times the capacity of one — seven separate daily buckets that
 * empty independently, which is the thing that actually matters. The day
 * stops ending because a single counter did.
 *
 * Ordered by what they are worth when they answer: Groq first because it is
 * already configured and fast, the big open-weight models next, the rest
 * behind them. A provider the server has no key for answers immediately and
 * is struck off for the session, so an unconfigured name costs one round trip
 * to our own server, once, and nothing after that.
 */
export const FALLBACKS = [GROQ, 'cerebras', 'openrouter', 'together', 'nvidia', 'mistral', 'cloudflare'];
