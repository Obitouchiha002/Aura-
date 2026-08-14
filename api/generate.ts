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

type Req = { method?: string; body?: any };
type Res = {
  status: (code: number) => Res;
  json: (body: any) => void;
  setHeader: (k: string, v: string) => void;
  end: () => void;
};

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

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Vercel parses JSON bodies; the local express server does too.
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const { provider = 'gemini', model, contents, systemInstruction, temperature } = body || {};

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

    res.status(200).json({ text: text || 'Silence.' });
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
