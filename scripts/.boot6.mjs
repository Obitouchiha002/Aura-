import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const theme of ['dark', 'light']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 300 }, deviceScaleFactor: 2 });
  if (theme === 'light') await ctx.addInitScript(() =>
    localStorage.setItem('aura_settings', JSON.stringify({ theme: 'light' })));
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000/', { waitUntil: 'commit' });
  await p.waitForSelector('#boot-eye');
  // Freeze the blink so the still shows the resting frame, not a random one.
  await p.addStyleTag({ content: '#boot-eye,#boot-tomoe{animation-play-state:paused!important}' });
  await p.screenshot({ path: `scripts/.rest-${theme}.png` });
  await ctx.close();
}
await b.close();
