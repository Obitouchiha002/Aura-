import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 400 } });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => localStorage.setItem('aura_settings', JSON.stringify({ theme: 'light' })));
await p.goto('http://localhost:3000/', { waitUntil: 'commit' });
await p.waitForTimeout(150);
console.log(await p.evaluate(() => ({
  htmlClass: document.documentElement.className,
  htmlDataTheme: document.documentElement.getAttribute('data-theme'),
  bootBg: getComputedStyle(document.getElementById('boot')).backgroundColor,
  saved: localStorage.getItem('aura_settings'),
})));
await p.waitForTimeout(1500);
console.log('after app boots:', await p.evaluate(() => ({
  htmlClass: document.documentElement.className,
  htmlDataTheme: document.documentElement.getAttribute('data-theme'),
  bodyBg: getComputedStyle(document.body).backgroundColor,
})));
await b.close();
