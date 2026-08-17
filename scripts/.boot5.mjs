import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 400 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  try { localStorage.setItem('aura_settings', JSON.stringify({ theme: 'light' })); } catch (e) {}
});
const p = await ctx.newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'commit' });
await p.waitForTimeout(160);
console.log('  during boot:', await p.evaluate(() => ({
  htmlClass: document.documentElement.className,
  bootBg: getComputedStyle(document.getElementById('boot')).backgroundColor,
})));
await p.screenshot({ path: 'scripts/.open-light.png' });
await p.waitForTimeout(1600);
console.log('  after app boots:', await p.evaluate(() => ({
  htmlClass: document.documentElement.className,
  bodyBg: getComputedStyle(document.body).backgroundColor,
})));
await b.close();
