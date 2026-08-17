import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push('pageerror: ' + e.message));

// Throttle so the boot screen is on glass long enough to sample, the way it
// is on a phone rather than on a warm desktop dev server.
const cdp = await p.context().newCDPSession(p);
await cdp.send('Network.emulateNetworkConditions', {
  offline: false, downloadThroughput: 400e3, uploadThroughput: 200e3, latency: 120,
});

await p.goto('http://localhost:3000/', { waitUntil: 'commit' });

// Sample the blink: the eye should be full height early, squashed at ~0.45s.
const shots = [];
for (const t of [120, 300, 450, 620, 1000]) {
  await p.waitForTimeout(t - (shots.at(-1)?.t ?? 0));
  const m = await p.evaluate(() => {
    const g = document.getElementById('boot-eye');
    if (!g) return null;
    const r = g.getBoundingClientRect();
    const boot = document.getElementById('boot').getBoundingClientRect();
    return {
      h: +r.height.toFixed(1),
      w: +r.width.toFixed(1),
      cx: +(r.x + r.width / 2 - (boot.x + boot.width / 2)).toFixed(1),
      cy: +(r.y + r.height / 2 - (boot.y + boot.height / 2)).toFixed(1),
    };
  });
  shots.push({ t, ...(m || { gone: true }) });
}
console.log('  t(ms)  eye w x h        offset from screen centre');
for (const s of shots) {
  console.log(s.gone
    ? `  ${String(s.t).padStart(5)}  boot screen removed`
    : `  ${String(s.t).padStart(5)}  ${String(s.w).padStart(5)} x ${String(s.h).padStart(5)}   x ${s.cx}  y ${s.cy}`);
}

await p.screenshot({ path: 'scripts/.boot-shot.png' });
await p.waitForTimeout(2500);
console.log('\n  after 3.5s, boot present?', await p.evaluate(() => !!document.getElementById('boot')));
console.log('  console errors:', errs.length ? errs : 'none');
await b.close();
