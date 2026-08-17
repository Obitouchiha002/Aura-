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

import { applyCors } from './_cors';

type Req = { method?: string; body?: any; headers?: Record<string, any> };
type Res = {
  status: (code: number) => Res;
  json: (body: any) => void;
  setHeader: (k: string, v: string) => void;
};

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
