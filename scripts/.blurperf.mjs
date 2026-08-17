import { chromium } from 'playwright-core';
import fs from 'node:fs';

const css = fs.readFileSync(fs.readdirSync('dist/assets')
  .filter(f => f.endsWith('.css')).map(f => 'dist/assets/' + f)[0], 'utf8');

const bubbles = Array.from({ length: 60 }, (_, i) => `
  <div class="max-w-[80%] ${i % 2 ? 'ml-auto' : ''} rounded-2xl border border-border bg-surface-2 p-4 shadow-soft">
    <p class="text-text-body">Message ${i}. Yeh ek lamba jawab hai jo kai lines leta hai taaki
    scroll container mein asli content jaisa weight bane aur maap sach ke kareeb rahe.</p>
  </div>`).join('');

const page$ = (blur) => `
<style>${css}</style>
<div class="flex flex-col h-screen bg-bg">
  <div class="relative z-20 px-4 pb-3 pt-3 border-b border-border bg-bg/85 ${blur ? 'backdrop-blur-xl' : ''} shadow-soft">
    <div class="flex items-center gap-2"><span class="font-display font-bold text-[20px] uppercase text-text-primary">AURA</span></div>
  </div>
  <div id="scroller" class="flex-1 overflow-y-auto p-4 space-y-4">${bubbles}</div>
</div>`;

const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

for (const blur of [true, false]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await p.setContent(page$(blur));
  await p.waitForTimeout(600);

  const fps = await p.evaluate(() => new Promise(res => {
    const el = document.getElementById('scroller');
    let n = 0, y = 0; const t0 = performance.now();
    const tick = () => {
      n++; y = (y + 14) % (el.scrollHeight - el.clientHeight); el.scrollTop = y;
      performance.now() - t0 < 4000 ? requestAnimationFrame(tick) : res(Math.round(n / 4));
    };
    requestAnimationFrame(tick);
  }));
  console.log(`  header backdrop-blur-xl ${blur ? 'ON ' : 'OFF'}  →  ${fps} fps while scrolling`);
  await ctx.close();
}
await b.close();
