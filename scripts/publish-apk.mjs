#!/usr/bin/env node
/**
 * Publishes a built APK and the manifest the app reads to find it.
 *
 *   node scripts/publish-apk.mjs 1.1.0
 *
 * Copies the release build into the site, writes apk.json beside it, and
 * updates the download page. The app checks apk.json on opening Settings, so
 * once this is deployed an update is offered inside the app rather than
 * requiring a trip to the site.
 *
 * The version must match versionName in android/app/build.gradle — that is what
 * the installed app compares against.
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SITE = 'https://aurashakti.vercel.app';
const BUILT = path.join(ROOT, 'android/app/build/outputs/apk/release/app-release.apk');
/**
 * Served from the app's own deployment rather than the marketing site. The
 * site is CLI-only, and when that session expired there was no way to publish
 * a build at all — including the one that fixed the bug being reported.
 */
const OUT = path.join(ROOT, 'public', 'download');

const version = process.argv[2];
const notes = process.argv[3];
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('Usage: node scripts/publish-apk.mjs <version> ["what changed"]');
  process.exit(1);
}

if (!fs.existsSync(BUILT)) {
  console.error(`No release build at ${path.relative(ROOT, BUILT)} — run gradlew assembleRelease first.`);
  process.exit(1);
}

// The installed app compares against versionName, so a mismatch here would
// offer an update that installs as the same version and never goes away.
const gradle = fs.readFileSync(path.join(ROOT, 'android/app/build.gradle'), 'utf8');
const named = /versionName\s+"([^"]+)"/.exec(gradle)?.[1];
if (named !== version) {
  console.error(`versionName in build.gradle is "${named}", not "${version}". Fix one of them.`);
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'public', 'updates'), { recursive: true });

// Only the current build stays on the site; older ones are only weight.
for (const f of fs.readdirSync(OUT)) {
  if (/^AuraShakti-.*\.apk$/.test(f) && f !== `AuraShakti-${version}.apk`) {
    fs.rmSync(path.join(OUT, f));
  }
}

const name = `AuraShakti-${version}.apk`;
fs.copyFileSync(BUILT, path.join(OUT, name));
const bytes = fs.readFileSync(path.join(OUT, name));
const sha256 = createHash('sha256').update(bytes).digest('hex');

fs.writeFileSync(
  path.join(ROOT, 'public', 'updates', 'apk.json'),
  JSON.stringify({
    version,
    url: `${SITE}/download/${name}`,
    size: bytes.length,
    sha256,
    ...(notes ? { notes } : {}),
  }, null, 2) + '\n',
);

// Keep the download page honest about what it is serving.
const buildPy = path.join(ROOT, 'landing', 'build.py');
let py = fs.readFileSync(buildPy, 'utf8');
py = py
  // Absolute, pointing at the app's deployment. The site no longer holds the
  // file, and a relative path there would be a dead link.
  .replace(/file="[^"]*AuraShakti-[^"]+\.apk"/, `file="${SITE}/download/${name}"`)
  .replace(/version="\d+\.\d+\.\d+"/, `version="${version}"`)
  .replace(/size="[^"]+"/, `size="${(bytes.length / 1048576).toFixed(1)} MB"`)
  .replace(/sha256="[a-f0-9]{64}"/, `sha256="${sha256}"`);
fs.writeFileSync(buildPy, py);
execSync('python3 build.py', { cwd: path.join(ROOT, 'landing'), stdio: 'inherit' });

console.log(`
  APK ${version} staged
    file      public/download/${name}
    size      ${(bytes.length / 1048576).toFixed(1)} MB
    sha256    ${sha256}
    manifest  public/updates/apk.json

  Commit and push. The app project deploys from git, and phones are offered
  the build from inside the app on the next check.
`);
