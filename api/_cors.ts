/**
 * Cross-origin access for the API routes.
 *
 * Inside the Android shell the page is not served from the deployed site — it
 * is served by the WebView itself, from https://localhost. Every call to
 * /api/generate is therefore a cross-origin request, and because it sends
 * Content-Type: application/json it is preflighted. Without these headers the
 * preflight was answered with 405 and no Access-Control-Allow-Origin, so the
 * WebView refused the request before it was ever sent and the app reported
 * "Failed to fetch" for every message.
 *
 * The list is explicit rather than a wildcard. CORS is not what keeps this
 * endpoint safe — anything that is not a browser ignores it entirely — but
 * naming the origins keeps other sites from quietly billing their traffic to
 * this key.
 *
 * The leading underscore keeps Vercel from treating this file as a route.
 */

const ALLOWED = new Set([
  // The Android and iOS shells. Capacitor serves the bundled app from these.
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
  // The deployed site. Same-origin in practice, listed so a preview
  // deployment calling production still works.
  'https://aurashakti.vercel.app',
  'https://aura-shakti-site.vercel.app',
  // Local development.
  'http://localhost:3000',
  'http://localhost:5173',
]);

type CorsRes = {
  status: (code: number) => CorsRes;
  json: (body: any) => void;
  setHeader: (k: string, v: string) => void;
  end?: () => void;
};

type CorsReq = { method?: string; headers?: Record<string, any> };

/**
 * Applies the headers and answers a preflight.
 *
 * Returns true when the request has been fully handled and the caller should
 * stop — which is the case for OPTIONS and nothing else.
 */
export function applyCors(req: CorsReq, res: CorsRes): boolean {
  const origin = String(req.headers?.origin || req.headers?.Origin || '');

  if (ALLOWED.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  // Caches must not serve one origin's response to another.
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    // 204 with no body is the conventional preflight answer.
    res.status(204);
    if (res.end) res.end();
    else res.json({});
    return true;
  }

  return false;
}
