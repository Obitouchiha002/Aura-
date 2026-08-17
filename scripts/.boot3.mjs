import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const theme of ['dark', 'light']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 400 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await p.evaluate(t => t === 'light'
    ? localStorage.setItem('aura_settings', JSON.stringify({ theme: 'light' }))
    : localStorage.removeItem('aura_settings'), theme);
  await p.goto('http://localhost:3000/', { waitUntil: 'commit' });
  await p.waitForTimeout(180);           // eye open
  await p.screenshot({ path: `scripts/.open-${theme}.png` });
  await ctx.close();
}
await b.close();
