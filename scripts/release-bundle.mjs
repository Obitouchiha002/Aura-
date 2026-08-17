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
const OUT = path.join(ROOT, 'landing', 'download', 'updates');
const SITE = 'https://aura-shakti-site.vercel.app';
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
const zipName = `bundle-${version}.zip`;
const zipPath = path.join(OUT, zipName);
fs.rmSync(zipPath, { force: true });

console.log('  Packing…');
// Zipped from inside dist, so index.html sits at the root of the archive —
// the plugin unpacks it as the web root and will not find it one level down.
run(`cd dist && zip -qr "${zipPath}" .`);

const bytes = fs.readFileSync(zipPath);
const checksum = createHash('sha256').update(bytes).digest('hex');

fs.writeFileSync(
  path.join(OUT, 'latest.json'),
  JSON.stringify({ version, url: `${SITE}/download/updates/${zipName}`, checksum }, null, 2) + '\n',
);

console.log(`
  Bundle ready
    file      landing/download/updates/${zipName}
    size      ${(bytes.length / 1024 / 1024).toFixed(1)} MB
    checksum  ${checksum}

  Next:
    1. Deploy the site so the zip is reachable:
         cd landing && npx vercel deploy --prod --yes --archive=tgz

    2. Point the app's update endpoint at it:
         npx vercel env rm BUNDLE_VERSION production --yes
         npx vercel env rm BUNDLE_URL production --yes
         npx vercel env rm BUNDLE_CHECKSUM production --yes
         printf '%s' '${version}' | npx vercel env add BUNDLE_VERSION production
         printf '%s' '${SITE}/download/updates/${zipName}' | npx vercel env add BUNDLE_URL production
         printf '%s' '${checksum}' | npx vercel env add BUNDLE_CHECKSUM production
         npx vercel deploy --prod --yes

  Phones pick it up on their next launch, and run it on the one after.
  A new APK is only needed when something native changes.
`);
