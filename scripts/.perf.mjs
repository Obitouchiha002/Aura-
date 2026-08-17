import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
// A budget Android is roughly 6x slower than this Mac.
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

await p.goto('http://localhost:3000/', { waitUntil: 'load' });
await p.waitForTimeout(4000);

const perf = await p.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const long = performance.getEntriesByType('longtask') || [];
  const paints = Object.fromEntries(
    performance.getEntriesByType('paint').map(e => [e.name, Math.round(e.startTime)]));
  const scripts = performance.getEntriesByType('resource')
    .filter(r => r.initiatorType === 'script' || r.name.endsWith('.js'))
    .map(r => ({ n: r.name.split('/').pop().slice(0, 34), ms: Math.round(r.duration), kb: Math.round((r.encodedBodySize||0)/1024) }))
    .sort((a, b) => b.kb - a.kb).slice(0, 8);
  return { domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), paints, scripts, longCount: long.length };
});

console.log('=== 6x CPU throttle (budget Android jaisa) ===');
console.log('  first paint          ', perf.paints['first-paint'], 'ms');
console.log('  first contentful     ', perf.paints['first-contentful-paint'], 'ms');
console.log('  DOMContentLoaded     ', perf.domContentLoaded, 'ms');
console.log('  load                 ', perf.load, 'ms');
console.log('\n  sabse bhaari scripts:');
for (const s of perf.scripts) console.log(`    ${String(s.kb).padStart(5)} KB  ${String(s.ms).padStart(5)} ms  ${s.n}`);

// Frame rate on the pre-auth screen, which has the glow + starfield.
const fps = await p.evaluate(() => new Promise(res => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; performance.now() - t0 < 3000 ? requestAnimationFrame(tick) : res(Math.round(n / 3)); };
  requestAnimationFrame(tick);
}));
console.log('\n  pre-auth screen fps  ', fps);
await b.close();
