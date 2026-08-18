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
const SITE = 'https://aura-shakti-site.vercel.app';
const BUILT = path.join(ROOT, 'android/app/build/outputs/apk/release/app-release.apk');
const OUT = path.join(ROOT, 'landing', 'download');

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

fs.mkdirSync(path.join(OUT, 'updates'), { recursive: true });

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
  path.join(OUT, 'updates', 'apk.json'),
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
  .replace(/file="download\/AuraShakti-[^"]+\.apk"/, `file="download/${name}"`)
  .replace(/version="\d+\.\d+\.\d+"/, `version="${version}"`)
  .replace(/size="[^"]+"/, `size="${(bytes.length / 1048576).toFixed(1)} MB"`)
  .replace(/sha256="[a-f0-9]{64}"/, `sha256="${sha256}"`);
fs.writeFileSync(buildPy, py);
execSync('python3 build.py', { cwd: path.join(ROOT, 'landing'), stdio: 'inherit' });

console.log(`
  APK ${version} staged
    file      landing/download/${name}
    size      ${(bytes.length / 1048576).toFixed(1)} MB
    sha256    ${sha256}
    manifest  landing/download/updates/apk.json

  Deploy the site and phones will be offered it inside the app:
    cd landing && npx vercel deploy --prod --yes --archive=tgz
`);
