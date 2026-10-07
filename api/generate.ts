/**
 * Server-side model proxy.
 *
 * The project's Gemini and Groq keys live here, in Vercel's environment, and
 * never reach the browser. Before this endpoint existed the key was inlined
 * into the client bundle by vite's `define`, which meant anyone who opened the
 * site could read it out of the JavaScript and spend the quota.
 *
 * A user who has pasted their own key into Settings still calls Google
 * directly from the browser — that is their key and their quota, and routing it
 * through here would only add a hop.
 *
 * The client keeps its own model-fallback and cooldown logic, so this stays
 * deliberately thin: one attempt, one model, and upstream failures are passed
 * back with their status intact so the caller can tell a quota error from an
 * outage.
 */

type Req = { method?: string; body?: any; headers?: Record<string, any> };
type Res = {
  status: (code: number) => Res;
  json: (body: any) => void;
  setHeader: (k: string, v: string) => void;
  end: () => void;
};

const RELAXED_SAFETY = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map(category => ({ category, threshold: 'BLOCK_ONLY_HIGH' }));

const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

/**
 * The Groq model the last-resort fallback asks for.
 *
 * This was `llama3-70b-8192`, which Groq decommissioned on 30 August 2025 — and
 * then its own replacement, `llama-3.3-70b-versatile`, went on 16 August 2026.
 * So the fallback that exists to catch a spent Gemini quota had been answering
 * 404 for a year, behind an error message that only said the Council was
 * "currently unavailable".
 *
 * Groq retires models roughly annually, so the name is read from the
 * environment: the next time this one goes, set GROQ_MODEL on the deployment
 * and the fallback is alive again without a release. Keep it in step with
 * GROQ_MODEL in services/geminiService.ts, which is the path taken when the
 * user has pasted their own gsk_ key.
 */
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

/* ── who is allowed to spend the quota ──────────────────────────────────── */

/**
 * This endpoint spends a real, finite quota, and it answered anyone.
 *
 * CORS is not a guard: a browser honours it, and nothing else does. The url is
 * in the shipped JavaScript, so finding it takes one look at the bundle, and a
 * script could then exhaust the day's Gemini allowance — and the Groq fallback
 * behind it — before anyone noticed the app had stopped answering.
 *
 * So requests now carry the caller's Firebase ID token, and it is checked here
 * against Google's public keys. No service account and no secret: the token is
 * signed by Google, the keys that verify it are published, and the claims say
 * which project it was issued for.
 */
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'techbyvansh-33439';
const JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/**
 * Whether a request without a valid token is refused.
 *
 * Off at first, and deliberately. Most of this app reaches phones as a
 * live-update bundle, so on the day this ships there are installs still running
 * web code that does not send a token — and refusing them would break chat on
 * the devices least able to tell anyone why. The clients start sending it now;
 * set REQUIRE_AUTH=true once the bundles have turned over, and the endpoint is
 * closed. No deploy, one variable.
 */
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

/**
 * A date after which an unverified caller is refused anyway.
 *
 * The grace period exists for one group: installs still running a web layer
 * that predates the token. They fetch a new bundle on launch and run it on the
 * one after, so the window is short — but it is not zero, and switching
 * enforcement on by hand means either doing it too early, which breaks their
 * next session, or forgetting, which leaves the endpoint open indefinitely.
 *
 * A date closes it on its own. Nobody has to remember, and nobody is cut off
 * before their app has had the chance to update itself.
 *
 * REQUIRE_AUTH=true still forces it immediately, and clearing this variable
 * reopens the endpoint — which is the lever to pull if the day it closes turns
 * out to be the day something unexpected breaks.
 */
const REQUIRE_AUTH_AFTER = process.env.REQUIRE_AUTH_AFTER || '2026-10-04';

function authRequiredNow(): boolean {
  if (REQUIRE_AUTH) return true;
  if (!REQUIRE_AUTH_AFTER) return false;
  const at = Date.parse(`${REQUIRE_AUTH_AFTER}T00:00:00Z`);
  return Number.isFinite(at) && Date.now() >= at;
}

/** Google's signing keys, kept between invocations on a warm instance. */
let jwkCache: { at: number; keys: Record<string, any> } | null = null;

async function signingKeys(): Promise<Record<string, any>> {
  // Google rotates these daily. An hour is well inside that, and saves a fetch
  // on every single message.
  if (jwkCache && Date.now() - jwkCache.at < 3600_000) return jwkCache.keys;

  const res = await fetch(JWK_URL);
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const body: any = await res.json();

  const keys: Record<string, any> = {};
  for (const k of body?.keys || []) if (k?.kid) keys[k.kid] = k;
  jwkCache = { at: Date.now(), keys };
  return keys;
}

function fromBase64Url(part: string): Uint8Array {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function jsonPart(part: string): any {
  return JSON.parse(new TextDecoder().decode(fromBase64Url(part)));
}

/**
 * The uid this token belongs to, or null if it does not hold up.
 *
 * Every reason to reject returns the same null: the caller only decides whether
 * to serve the request, and a message naming which claim was wrong would tell a
 * prober how to get closer.
 */
async function callerUid(authHeader: string | undefined): Promise<string | null> {
  const token = /^Bearer (.+)$/.exec(String(authHeader || ''))?.[1];
  if (!token) return null;

  const [h, p, sig] = token.split('.');
  if (!h || !p || !sig) return null;

  try {
    const header = jsonPart(h);
    if (header?.alg !== 'RS256' || !header?.kid) return null;

    const jwk = (await signingKeys())[header.kid];
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk', jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify'],
    );

    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', key,
      fromBase64Url(sig),
      new TextEncoder().encode(`${h}.${p}`),
    );
    if (!ok) return null;

    // A valid signature only proves Google issued it. These say it was issued
    // for this project, to a real user, and has not expired — without them a
    // token from any other Firebase project in the world would pass.
    const claims = jsonPart(p);
    const now = Math.floor(Date.now() / 1000);
    if (claims?.aud !== PROJECT_ID) return null;
    if (claims?.iss !== `https://securetoken.google.com/${PROJECT_ID}`) return null;
    if (!claims?.sub || typeof claims.sub !== 'string') return null;
    if (typeof claims?.exp !== 'number' || claims.exp <= now) return null;

    return claims.sub;
  } catch {
    return null;
  }
}

/**
 * The site this request is being made on behalf of.
 *
 * The Gemini key is locked to an HTTP referrer in the Google console. That
 * restriction is worth keeping now that the key is server-side — if it ever
 * leaks again it is still bound to this one site — so the origin is sent
 * explicitly. Override with SITE_ORIGIN if the domain changes.
 */
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://aurashakti.vercel.app/';

/**
 * Cross-origin access.
 *
 * Inside the Android shell the page is served by the WebView from
 * https://localhost, so every call here is cross-origin, and sending JSON
 * makes it preflighted. Answering OPTIONS with 405 and no
 * Access-Control-Allow-Origin is what made the WebView refuse the request
 * before sending it, so every message failed with "Failed to fetch".
 *
 * Written out in each handler rather than shared through a helper module:
 * these files are the deployment's entrypoints, and a relative import between
 * them failed to resolve at runtime and took the whole function down. A dozen
 * duplicated lines are worth more than that.
 *
 * The list is explicit. CORS is not what protects this endpoint — anything
 * that is not a browser ignores it — but naming the origins stops other sites
 * billing their traffic to this key.
 */
const ALLOWED_ORIGINS = new Set([
  'https://localhost',        // Capacitor Android
  'capacitor://localhost',    // Capacitor iOS
  'ionic://localhost',
  'https://aurashakti.vercel.app',
  'https://aurashakti.lzworth.in',   // the app's own domain
  'https://aura.lzworth.in',         // the marketing site
  'https://aura-shakti-site.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
]);

/** Sets the headers, and answers a preflight. True means "already handled". */
function applyCors(req: any, res: any): boolean {
  const origin = String(req?.headers?.origin || '');
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req?.method === 'OPTIONS') {
    res.status(204);
    if (typeof res.end === 'function') res.end();
    else res.json({});
    return true;
  }
  return false;
}

export default async function handler(req: Req, res: Res) {
  // Must run before anything else: the shell's preflight arrives as OPTIONS,
  // and answering it with 405 is what broke every chat inside the APK.
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const uid = await callerUid(req?.headers?.authorization);

  /**
   * Says whether the token checked out, without acting on it.
   *
   * While REQUIRE_AUTH is off a good token and a forged one are served alike,
   * so there is no way to tell from a response whether the verification works —
   * and switching enforcement on to find out would lock everyone out if it did
   * not. This header makes that answerable before the switch is thrown, and
   * afterwards it says how many callers are still arriving without one.
   */
  res.setHeader('x-aura-auth', uid ? 'verified' : (authRequiredNow() ? 'refused' : 'anonymous'));

  if (!uid && authRequiredNow()) {
    res.status(401).json({ error: 'Sign in to use this.' });
    return;
  }

  // Vercel parses JSON bodies; the local express server does too.
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const { provider = 'gemini', model, contents, systemInstruction, temperature, relaxSafety, grounded } = body || {};

  if (!Array.isArray(contents) || contents.length === 0) {
    res.status(400).json({ error: 'contents is required' });
    return;
  }

  try {
    if (provider === 'groq') {
      const key = process.env.GROQ_API_KEY;
      if (!key) {
        res.status(503).json({ error: 'No Groq key configured on the server.' });
        return;
      }

      const messages: any[] = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      for (const msg of contents) {
        messages.push({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.parts?.[0]?.text ?? '',
        });
      }

      const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: temperature ?? 0.7 }),
      });

      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        // Say when the model itself is the problem. A decommissioned name
        // returns 404 or 400 with `model_not_found`, and reporting that as a
        // plain outage is what kept this broken for a year.
        const code = data?.error?.code || '';
        const gone = upstream.status === 404 || code === 'model_not_found'
          || code === 'model_decommissioned';
        res.status(upstream.status).json({
          error: gone
            ? `Groq model ${GROQ_MODEL} is not available (${describe(data, upstream.status)}). Set GROQ_MODEL on the deployment to a current one.`
            : describe(data, upstream.status),
        });
        return;
      }
      res.status(200).json({ text: data?.choices?.[0]?.message?.content || 'Silence.' });
      return;
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      res.status(503).json({ error: 'No Gemini key configured on the server.' });
      return;
    }
    if (!model) {
      res.status(400).json({ error: 'model is required' });
      return;
    }

    const upstream = await fetch(GEMINI_ENDPOINT(model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
        'Referer': SITE_ORIGIN,
      },
      body: JSON.stringify({
        contents,
        ...(systemInstruction
          ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
          : {}),
        // Asked for by the character rooms only — see RELAXED_SAFETY in
        // geminiService. The default setting sands the edges off characters
        // written to be blunt and amoral, which reads as the whole app having
        // become cautious. ONLY_HIGH still blocks severe content. The
        // Psychologist never sets this.
        ...(relaxSafety ? { safetySettings: RELAXED_SAFETY } : {}),
        /**
         * Let the model look things up.
         *
         * Asked for per request rather than switched on everywhere. A room
         * built on a character should not stop mid-sentence to cite a web
         * page — but a room that explains a chapter to someone revising for an
         * exam should not be inventing dates either, and until now it had no
         * way to check one.
         */
        ...(grounded ? { tools: [{ googleSearch: {} }] } : {}),
        generationConfig: { temperature: temperature ?? 0.7 },
      }),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: describe(data, upstream.status) });
      return;
    }

    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((p: any) => p?.text || '')
      .join('')
      .trim();

    if (!text) {
      // A 200 with no text means the model produced nothing — almost always a
      // safety stop, occasionally a recitation or token limit. Returning the
      // word "Silence." for this hid a real failure behind something that
      // looked like a deliberate answer, and made it untestable. Say which.
      const blocked =
        data?.promptFeedback?.blockReason ||
        data?.candidates?.[0]?.finishReason ||
        'EMPTY';
      const ratings = (data?.candidates?.[0]?.safetyRatings || [])
        .filter((r: any) => r?.blocked || r?.probability === 'HIGH' || r?.probability === 'MEDIUM')
        .map((r: any) => `${r.category}=${r.probability}`)
        .join(' ');
      res.status(502).json({ error: `blocked ${blocked}${ratings ? ' ' + ratings : ''}` });
      return;
    }

    /**
     * Where the answer came from.
     *
     * Returned as the title and url of each source rather than as the HTML
     * blob Google also sends back, because that blob would have to be injected
     * into the page unescaped. Links the client renders itself cannot carry a
     * script with them.
     *
     * Note for whoever turns this on more widely: Google's terms require the
     * search-suggestions entry point to be displayed alongside a grounded
     * answer, and these citations are not that. It is passed through below so
     * the UI can render it when someone has read those terms.
     */
    const grounding = data?.candidates?.[0]?.groundingMetadata;
    const sources = (grounding?.groundingChunks || [])
      .map((c: any) => c?.web)
      .filter((w: any) => w?.uri)
      .map((w: any) => ({ title: String(w.title || w.uri), uri: String(w.uri) }));

    res.status(200).json({
      text,
      ...(sources.length ? { sources } : {}),
      ...(grounding?.searchEntryPoint?.renderedContent
        ? { searchSuggestions: grounding.searchEntryPoint.renderedContent }
        : {}),
    });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Upstream request failed' });
  }
}

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}

/** Keeps the upstream status in the message — the client branches on it. */
function describe(data: any, status: number): string {
  const detail = data?.error?.message || data?.message || '';
  return `${status} ${detail}`.trim();
}
