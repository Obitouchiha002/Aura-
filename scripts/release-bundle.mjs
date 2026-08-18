#!/usr/bin/env node
/**
 * Cuts a live-update bundle.
 *
 *   node scripts/release-bundle.mjs 1.0.1
 *
 * Builds the web app the way the Android shell expects it, zips the result,
 * drops it into the site's updates folder, and prints the two environment
 * variables to set on the app's Vercel project.
 *
 * The version has to climb. The plugin compares it against what the phone is
 * already running, so a bundle numbered the same as — or below — the installed
 * one is ignored, which looks exactly like a broken update.
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
/**
 * The bundle ships with the app's own deployment, not the marketing site.
 *
 * It used to live on the site, which is only ever deployed from the Vercel
 * CLI — so when that session expired there was no way to publish an update at
 * all, with a fix already written and phones unable to receive it. The app
 * project deploys from a git push, which is one less thing that can be
 * unavailable at the wrong moment.
 */
const OUT = path.join(ROOT, 'public', 'updates');
const SITE = 'https://aurashakti.vercel.app';
const API = 'https://aurashakti.vercel.app';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('Usage: node scripts/release-bundle.mjs <version>   e.g. 1.0.1');
  process.exit(1);
}

const run = (cmd, env = {}) =>
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });

console.log(`\n  Building the web layer for ${version}…`);
// Same flag the APK is built with: inside the shell the page is served from
// capacitor://localhost, so the API has to be absolute.
run('npx vite build', { VITE_API_BASE: API });

fs.mkdirSync(OUT, { recursive: true });
// Older bundles would otherwise ride along in every deployment forever.
for (const f of fs.readdirSync(OUT)) {
  if (/^bundle-.*\.zip$/.test(f) && f !== `bundle-${version}.zip`) fs.rmSync(path.join(OUT, f));
}
const zipName = `bundle-${version}.zip`;
const zipPath = path.join(OUT, zipName);
fs.rmSync(zipPath, { force: true });

console.log('  Packing…');
// Zipped from inside dist, so index.html sits at the root of the archive —
// the plugin unpacks it as the web root and will not find it one level down.
// updates/ is excluded or each release would contain the previous one, and
// the bundle would double in size every time.
run(`cd dist && zip -qr "${zipPath}" . -x 'updates/*'`);

const bytes = fs.readFileSync(zipPath);
const checksum = createHash('sha256').update(bytes).digest('hex');

fs.writeFileSync(
  path.join(OUT, 'latest.json'),
  JSON.stringify({ version, url: `${SITE}/updates/${zipName}`, checksum }, null, 2) + '\n',
);

console.log(`
  Bundle ready
    file      public/updates/${zipName}
    size      ${(bytes.length / 1024 / 1024).toFixed(1)} MB
    checksum  ${checksum}

  Next:
    Commit and push. The app project deploys from git, and /api/updates reads
    latest.json from the same deployment — so the manifest can never name a
    bundle that is not there.

    Only if pinning or rolling back:
         npx vercel env rm BUNDLE_VERSION production --yes
         npx vercel env rm BUNDLE_URL production --yes
         npx vercel env rm BUNDLE_CHECKSUM production --yes
         printf '%s' '${version}' | npx vercel env add BUNDLE_VERSION production
         printf '%s' '${SITE}/updates/${zipName}' | npx vercel env add BUNDLE_URL production
         printf '%s' '${checksum}' | npx vercel env add BUNDLE_CHECKSUM production
         npx vercel deploy --prod --yes

  Phones pick it up on their next launch, and run it on the one after.
  A new APK is only needed when something native changes.
`);
