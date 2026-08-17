import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

for (const theme of ['dark', 'light']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));

  await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  if (theme === 'light') {
    await p.evaluate(() => localStorage.setItem('aura_settings', JSON.stringify({ theme: 'light' })));
  }
  await p.goto('http://localhost:3000/', { waitUntil: 'commit' });

  // Catch it mid-blink for the picture.
  await p.waitForTimeout(450);
  const mid = await p.evaluate(() => {
    const g = document.getElementById('boot-eye');
    return g ? +g.getBoundingClientRect().height.toFixed(1) : null;
  });
  await p.screenshot({ path: `scripts/.boot-${theme}-blink.png` });

  await p.waitForTimeout(400);           // eye open again
  await p.screenshot({ path: `scripts/.boot-${theme}-open.png` });

  const t0 = Date.now();
  await p.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 15000 })
    .then(() => console.log(`  [${theme}] boot removed at ${Date.now() - t0 + 850}ms`))
    .catch(() => console.log(`  [${theme}] BOOT NEVER REMOVED`));

  console.log(`  [${theme}] eye height mid-blink: ${mid}px   errors: ${errs.length ? errs.join(' | ') : 'none'}`);
  await ctx.close();
}
await b.close();
