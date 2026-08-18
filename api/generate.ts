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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

  // Vercel parses JSON bodies; the local express server does too.
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const { provider = 'gemini', model, contents, systemInstruction, temperature, relaxSafety } = body || {};

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
        body: JSON.stringify({ model: 'llama3-70b-8192', messages, temperature: temperature ?? 0.7 }),
      });

      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: describe(data, upstream.status) });
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

    res.status(200).json({ text });
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
