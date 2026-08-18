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
 * The manifest comes from latest.json, which scripts/release-bundle.mjs writes
 * next to the zip it just built and the site deploy publishes alongside it. So
 * cutting a release is one deploy, and the manifest cannot disagree with the
 * bundle sitting beside it.
 *
 * It used to be three environment variables instead. That made a release two
 * steps that had to agree, and when Vercel's API was unreachable the variables
 * were deleted but could not be written back — which silently turned live
 * updates off altogether. A file that ships with the bundle has no such gap.
 *
 * BUNDLE_VERSION / BUNDLE_URL / BUNDLE_CHECKSUM still win if they are set, so a
 * release can be pinned or rolled back without a deploy.
 *
 * If neither source can be read the endpoint reports "nothing new", which is
 * the safe answer — an app that cannot read a manifest keeps what it has.
 */

/**
 * The manifest ships with this deployment, so it is read from this origin.
 * Pointing at the marketing site meant a release needed the Vercel CLI, and
 * when that session expired updates could not be published at all.
 */
const SITE = process.env.SITE_URL || 'https://aurashakti.vercel.app';
const MANIFEST_URL = `${SITE}/updates/latest.json`;

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

  let version = process.env.BUNDLE_VERSION;
  let url = process.env.BUNDLE_URL;
  let checksum = process.env.BUNDLE_CHECKSUM;

  if (!version || !url) {
    try {
      const manifest: any = await fetch(MANIFEST_URL, { cache: 'no-store' } as any)
        .then(r => (r.ok ? r.json() : null));
      if (manifest?.version && manifest?.url) {
        version = manifest.version;
        url = manifest.url;
        checksum = manifest.checksum;
      }
    } catch {
      // Unreachable manifest is not an error worth failing on — saying
      // "nothing new" leaves the phone on a build that already works.
    }
  }

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
    ...(checksum ? { checksum } : {}),
  });
}
