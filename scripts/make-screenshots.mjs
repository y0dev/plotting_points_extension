/**
 * Generate placeholder screenshots (images/screenshot-light.png /
 * screenshot-dark.png) so the README image links resolve before a real capture
 * is taken. Replace these with actual Extension Development Host screenshots —
 * see "Capturing screenshots" in the README.
 *
 * Pure Node (zlib only). Run: `node scripts/make-screenshots.mjs`
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const W = 1200;
const H = 760;

const PALETTE = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728"];

function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function makeImage({ bg, panel, fg, grid }) {
  const px = Buffer.alloc(W * H * 4);
  const set = (x, y, [r, g, b], a = 1) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    const inv = 1 - a;
    px[i] = px[i] * inv + r * a;
    px[i + 1] = px[i + 1] * inv + g * a;
    px[i + 2] = px[i + 2] * inv + b * a;
    px[i + 3] = 255;
  };
  const rect = (x0, y0, x1, y1, color, a = 1) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, color, a);
  };
  const line = (ax, ay, bx, by, color, width) => {
    const hw = width / 2;
    const minX = Math.floor(Math.min(ax, bx) - hw - 1);
    const maxX = Math.ceil(Math.max(ax, bx) + hw + 1);
    const minY = Math.floor(Math.min(ay, by) - hw - 1);
    const maxY = Math.ceil(Math.max(ay, by) + hw + 1);
    const vx = bx - ax, vy = by - ay;
    const len2 = vx * vx + vy * vy || 1;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        let t = ((x - ax) * vx + (y - ay) * vy) / len2;
        t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(x - (ax + t * vx), y - (ay + t * vy)) - hw;
        const c = Math.min(1, Math.max(0, 0.75 - d));
        if (c > 0) set(x, y, color, c);
      }
  };

  rect(0, 0, W, H, hex(bg));
  // header bar
  rect(0, 0, W, 56, hex(panel));
  rect(16, 20, 40, 44, hex("#155a8a"));
  // left files panel
  rect(24, 80, 300, H - 24, hex(panel));
  for (let i = 0; i < 4; i++) rect(40, 110 + i * 34, 284, 134 + i * 34, hex(grid), 0.6);
  // plot panel
  const px0 = 330, py0 = 96, px1 = W - 40, py1 = H - 48;
  rect(px0, py0, px1, py1, hex(panel));
  // axes + gridlines
  for (let i = 1; i < 6; i++) {
    const gy = py0 + 40 + ((py1 - py0 - 80) * i) / 6;
    line(px0 + 60, gy, px1 - 30, gy, hex(grid), 1.5);
  }
  line(px0 + 60, py0 + 30, px0 + 60, py1 - 40, hex(fg), 2);
  line(px0 + 60, py1 - 40, px1 - 30, py1 - 40, hex(fg), 2);
  // fake series
  const series = [
    [0.15, 0.55, 0.35, 0.62, 0.5, 0.28, 0.7, 0.7, 0.86, 0.4],
    [0.15, 0.8, 0.35, 0.5, 0.5, 0.75, 0.7, 0.35, 0.86, 0.6],
    [0.15, 0.35, 0.35, 0.4, 0.5, 0.5, 0.7, 0.52, 0.86, 0.66],
  ];
  const gx0 = px0 + 60, gx1 = px1 - 30, gy0 = py0 + 30, gy1 = py1 - 40;
  series.forEach((pts, si) => {
    for (let k = 0; k < pts.length - 2; k += 2) {
      line(
        gx0 + pts[k] * (gx1 - gx0),
        gy1 - pts[k + 1] * (gy1 - gy0),
        gx0 + pts[k + 2] * (gx1 - gx0),
        gy1 - pts[k + 3] * (gy1 - gy0),
        hex(PALETTE[si]),
        4,
      );
    }
  });
  // footer/status bar
  rect(0, H - 22, W, H, hex(panel));

  return px;
}

function encodePng(px) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0, 0);
    return Buffer.concat([len, td, crc]);
  };
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  function crc32(b) {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = table[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return c ^ 0xffffffff;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("images", { recursive: true });
writeFileSync(
  "images/screenshot-light.png",
  encodePng(makeImage({ bg: "#f3f3f3", panel: "#ffffff", fg: "#1c2733", grid: "#d6dbe2" })),
);
writeFileSync(
  "images/screenshot-dark.png",
  encodePng(makeImage({ bg: "#1e1e1e", panel: "#252526", fg: "#cccccc", grid: "#3c3c3c" })),
);
console.log("wrote images/screenshot-light.png and images/screenshot-dark.png (placeholders)");
