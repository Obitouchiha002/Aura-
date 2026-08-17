/**
 * Where the Android app asks whether there is a newer build of the web layer.
 *
 * Almost everything in this app is web assets, so almost every change can
 * reach a phone without a new APK. The app posts its current version here on
 * launch; if this endpoint names a higher one, the plugin downloads that
 * bundle and swaps it in on the next start.
 *
 * A new APK is still needed when something native changes — a new plugin, an
 * icon, a permission, an SDK bump. Everything else ships from here.
 *
 * The manifest is set through two environment variables so a release is a
 * config change rather than a redeploy of this function:
 *
 *   BUNDLE_VERSION  e.g. 1.0.1
 *   BUNDLE_URL      the zip of dist/, served from the site
 *
 * With neither set the endpoint reports "nothing new", which is the safe
 * answer — an app that cannot read a manifest simply keeps what it has.
 */

type Req = { method?: string; body?: any; headers?: Record<string, any> };
type Res = {
  status: (code: number) => Res;
  json: (body: any) => void;
  setHeader: (k: string, v: string) => void;
};

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
  // The updater plugin is native and never preflights, but the manifest is
  // also useful from a browser while debugging a release.
  if (applyCors(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const version = process.env.BUNDLE_VERSION;
  const url = process.env.BUNDLE_URL;

  // The plugin treats a response without a url as "you are current".
  if (!version || !url) {
    res.status(200).json({ message: 'No update available' });
    return;
  }

  res.status(200).json({
    version,
    url,
    // Told to the plugin so a half-downloaded bundle is discarded rather than
    // installed.
    ...(process.env.BUNDLE_CHECKSUM ? { checksum: process.env.BUNDLE_CHECKSUM } : {}),
  });
}
