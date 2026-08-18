#!/usr/bin/env node
/**
 * Renders the PWA icons from the same mark the Android launcher uses.
 *
 *   node scripts/make-icons.mjs
 *
 * The web app shipped a completely different logo — and icon-192.png was a
 * 1536x1024 landscape image declared in the manifest as 192x192, so Android
 * squashed it into the launcher. Installed from the browser the app looked
 * like a different product from the one on the Play-less store page.
 *
 * Two variants are produced. The plain one is the icon as drawn. The maskable
 * one has the mark pulled into the centre 68%, because Android crops a
 * maskable icon to whatever shape the launcher wants and anything near the
 * edge is simply cut off.
 *
 * Chrome does the rendering — it is already here, and it is the same engine
 * that draws this mark everywhere else in the app.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(ROOT, 'public');

const JOBS = [
  { svg: 'assets/icon.svg',          out: 'icon-192.png',            size: 192 },
  { svg: 'assets/icon.svg',          out: 'icon-512.png',            size: 512 },
  { svg: 'assets/icon-maskable.svg', out: 'icon-maskable-512.png',   size: 512 },
  { svg: 'assets/icon.svg',          out: 'apple-touch-icon.png',    size: 180 },
  { svg: 'assets/icon.svg',          out: 'favicon-64.png',          size: 64  },
];

const TMP = fs.mkdtempSync(path.join(ROOT, '.icons-'));

for (const job of JOBS) {
  const dest = path.join(OUT, job.out);

  // The source declares width="1024". Rendered in a 192px window Chrome draws
  // it at 1024 and crops to the top-left corner — which is exactly how the
  // launch image ended up off-centre once already. Restate the size to match
  // the window and there is nothing left to get wrong.
  const svg = fs.readFileSync(path.join(ROOT, job.svg), 'utf8')
    .replace(/width="\d+"/, `width="${job.size}"`)
    .replace(/height="\d+"/, `height="${job.size}"`);
  const sized = path.join(TMP, `${job.size}-${path.basename(job.svg)}`);
  fs.writeFileSync(sized, svg);

  execFileSync(CHROME, [
    '--headless',
    '--disable-gpu',
    `--screenshot=${dest}`,
    `--window-size=${job.size},${job.size}`,
    '--hide-scrollbars',
    `file://${sized}`,
  ], { stdio: 'ignore' });

  const b = fs.readFileSync(dest);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  const ok = w === job.size && h === job.size;
  console.log(`  ${job.out.padEnd(24)} ${w}x${h}  ${(b.length / 1024).toFixed(0)} KB  ${ok ? 'ok' : 'WRONG SIZE'}`);
}

fs.rmSync(TMP, { recursive: true, force: true });
