#!/usr/bin/env node
/**
 * Generates the FORGE PWA icons (PNG + SVG) without external dependencies.
 * The logo is a lime rounded square with a dark "F" mark.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const LIME = [163, 230, 53];
const DARK = [11, 12, 14];

// Logo in a 32×32 design grid.
const F_RECTS = [
  [10, 8, 14.5, 24],
  [10, 8, 23, 12],
  [10, 15.5, 21, 19.5],
];
const inF = (x, y) => F_RECTS.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** mode 'any': transparent outside rounded square. 'maskable': full-bleed dark bg, logo in safe zone. */
function render(size, mode) {
  const px = new Uint8Array(size * size * 4);
  const ss = 4;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          let u = ((i + (sx + 0.5) / ss) / size) * 32;
          let v = ((j + (sy + 0.5) / ss) / size) * 32;
          let col = null;
          if (mode === 'maskable') {
            col = DARK;
            // logo occupies the central 62% (inside the 80% safe zone)
            const k = 32 / (32 * 0.62);
            const lu = (u - 16) * k + 16;
            const lv = (v - 16) * k + 16;
            if (inRoundRect(lu, lv, 0, 0, 32, 32, 9)) col = inF(lu, lv) ? DARK : LIME;
          } else if (inRoundRect(u, v, 0, 0, 32, 32, 9)) {
            col = inF(u, v) ? DARK : LIME;
          }
          if (col) { r += col[0]; g += col[1]; b += col[2]; a += 255; }
        }
      }
      const n = ss * ss;
      const o = (j * size + i) * 4;
      const cov = a / 255;
      px[o] = cov ? Math.round(r / cov) : 0;
      px[o + 1] = cov ? Math.round(g / cov) : 0;
      px[o + 2] = cov ? Math.round(b / cov) : 0;
      px[o + 3] = Math.round(a / n);
    }
  }
  return png(size, size, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'icon-192.png'), render(192, 'any'));
writeFileSync(join(OUT, 'icon-512.png'), render(512, 'any'));
writeFileSync(join(OUT, 'icon-maskable-512.png'), render(512, 'maskable'));
writeFileSync(join(OUT, 'apple-touch-icon.png'), render(180, 'maskable'));
writeFileSync(
  join(OUT, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#a3e635"/><path d="M10 8h13v4h-8.5v3.5H21v4h-6.5V24H10z" fill="#0b0c0e"/></svg>\n`,
);
console.log('Generated PWA icons in public/icons');
