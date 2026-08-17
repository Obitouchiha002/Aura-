import fs from 'node:fs';
import path from 'node:path';
const dir = '/tmp/apkchk/res';
const hits = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.png') || f.endsWith('.9.png')) continue;
  const full = path.join(dir, f);
  const fd = fs.openSync(full, 'r');
  const b = Buffer.alloc(24);
  fs.readSync(fd, b, 0, 24, 0);
  fs.closeSync(fd);
  if (b[1] !== 0x50) continue;
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  // Splash images are the only tall/wide non-square art in here.
  if (w !== h && Math.max(w, h) >= 320 && Math.min(w, h) >= 200) hits.push({ full, w, h });
}
hits.sort((a, b) => b.w * b.h - a.w * a.h);
console.log(hits.map(h => `${h.full} ${h.w}x${h.h}`).join('\n'));
