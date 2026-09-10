/**
 * Generate images/icon.png (the extension icon) from the exact geometry of the
 * two-tone line icon in the source app's SVG favicon (xy_plot_viewer.html):
 *
 *   <rect width=100 height=100 rx=22 fill=#155a8a/>
 *   <polyline points="10,55 30,35 50,45 70,20 90,30" stroke=#ffffff stroke-width=6/>
 *   <polyline points="10,70 30,60 50,65 70,50 90,58" stroke=#ff7f0e stroke-width=6/>
 *
 * Pure Node (zlib only) so there is no image-library build dependency.
 * Run: `node scripts/make-icon.mjs`
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const SIZE = 256;
const s = SIZE / 100;
const SS = 4; // supersampling factor for anti-aliasing

const W = SIZE * SS;
const H = SIZE * SS;
const buf = new Float64Array(W * H * 4); // rgba, 0..255, premultiplied-ish straight

function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function plot(x, y, [r, g, b], a) {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (y * W + x) * 4;
  const inv = 1 - a;
  buf[i] = buf[i] * inv + r * a;
  buf[i + 1] = buf[i + 1] * inv + g * a;
  buf[i + 2] = buf[i + 2] * inv + b * a;
  buf[i + 3] = Math.min(255, buf[i + 3] * inv + 255 * a);
}

function fillRoundRect(x0, y0, x1, y1, rad, color) {
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      // distance outside the rounded rect (0 inside)
      const dx = Math.max(x0 + rad - x, x - (x1 - rad), 0);
      const dy = Math.max(y0 + rad - y, y - (y1 - rad), 0);
      const d = Math.hypot(dx, dy) - rad;
      const cover = Math.min(1, Math.max(0, 0.5 - d));
      if (x >= x0 + rad && x <= x1 - rad) { plot(x, y, color, y >= y0 && y <= y1 ? 1 : 0); continue; }
      if (y >= y0 + rad && y <= y1 - rad) { plot(x, y, color, x >= x0 && x <= x1 ? 1 : 0); continue; }
      plot(x, y, color, cover);
    }
  }
}

function strokePolyline(points, width, color) {
  const hw = width / 2;
  for (let seg = 0; seg < points.length - 1; seg++) {
    const [ax, ay] = points[seg];
    const [bx, by] = points[seg + 1];
    const minX = Math.floor(Math.min(ax, bx) - hw - 1);
    const maxX = Math.ceil(Math.max(ax, bx) + hw + 1);
    const minY = Math.floor(Math.min(ay, by) - hw - 1);
    const maxY = Math.ceil(Math.max(ay, by) + hw + 1);
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy || 1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let t = ((x - ax) * vx + (y - ay) * vy) / len2;
        t = Math.max(0, Math.min(1, t)); // round caps + joins
        const px = ax + t * vx;
        const py = ay + t * vy;
        const d = Math.hypot(x - px, y - py) - hw;
        const cover = Math.min(1, Math.max(0, 0.5 - d));
        if (cover > 0) plot(x, y, color, cover);
      }
    }
  }
}

const P = (pts) => pts.map(([x, y]) => [x * s * SS, y * s * SS]);

fillRoundRect(0, 0, W, H, 22 * s * SS, hex("#155a8a"));
strokePolyline(P([[10, 55], [30, 35], [50, 45], [70, 20], [90, 30]]), 6 * s * SS, hex("#ffffff"));
strokePolyline(P([[10, 70], [30, 60], [50, 65], [70, 50], [90, 58]]), 6 * s * SS, hex("#ff7f0e"));

// Downsample SS×SS -> 1 with a box filter, into an 8-bit RGBA raster.
const out = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
        r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3];
      }
    }
    const n = SS * SS;
    const o = (y * SIZE + x) * 4;
    out[o] = Math.round(r / n);
    out[o + 1] = Math.round(g / n);
    out[o + 2] = Math.round(b / n);
    out[o + 3] = Math.round(a / n);
  }
}

// Encode a minimal PNG (single IDAT, filter 0 per scanline).
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0, 0);
  return Buffer.concat([len, td, crc]);
}
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  out.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync("images", { recursive: true });
writeFileSync("images/icon.png", png);
console.log(`wrote images/icon.png (${SIZE}x${SIZE}, ${png.length} bytes)`);
