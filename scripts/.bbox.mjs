import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const file = process.argv[2];
const b = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--allow-file-access-from-files'],
});
const p = await b.newPage();
const dataUrl = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
await p.goto('about:blank');
const r = await p.evaluate(async (u) => {
  const img = new Image(); img.src = u;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 40 || d[i+1] > 40 || d[i+2] > 40) {
      const px = (i / 4) % c.width, py = Math.floor((i / 4) / c.width);
      if (px < x0) x0 = px; if (px > x1) x1 = px;
      if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
  }
  return { w: c.width, h: c.height, x0, x1, y0, y1 };
}, dataUrl);
await b.close();
const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
console.log(`  ${path.basename(file)}   canvas ${r.w}x${r.h}`);
console.log(`  mark   ${r.x1-r.x0} x ${r.y1-r.y0} px`);
console.log(`  OFFSET from centre:  ${(cx - r.w/2).toFixed(1)} px horizontal,  ${(cy - r.h/2).toFixed(1)} px vertical`);
