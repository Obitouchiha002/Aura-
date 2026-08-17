#!/usr/bin/env node
/**
 * Renders assets/splash.svg to the PNG that @capacitor/assets expects.
 *
 *   node scripts/make-splash.mjs
 *   npx @capacitor/assets generate --android
 *   npx cap sync android
 *
 * Chrome does the rendering because it is already on this machine and it is
 * the same engine that draws the mark everywhere else in the app, so the
 * launch image and the boot screen cannot drift apart.
 *
 * The page is the SVG on its own — no HTML wrapper. The wrapper is what put
 * the mark off-centre the first time round: the SVG was wider than the div
 * holding it, so centring the div left the mark hanging out to one side.
 */

import { chromium } from 'playwright-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'assets', 'splash.svg');
const OUT = path.join(ROOT, 'assets', 'splash.png');
const SIZE = 2732;

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({
  viewport: { width: SIZE, height: SIZE },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(SRC).href);
await page.screenshot({ path: OUT });
await browser.close();

console.log(`  ${path.relative(ROOT, OUT)}  ${SIZE}x${SIZE}`);
