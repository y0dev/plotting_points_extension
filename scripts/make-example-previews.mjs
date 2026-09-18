/**
 * Generate small chart-shaped preview images for the example data files
 * referenced in the README — real geometry computed from the actual example
 * data (examples/match_scan_001.xy, examples/measurement_errors.y), drawn
 * with the same axis/gridline/color conventions as baseLayout() in
 * src/webview/render.ts. No text is rendered (no font renderer here); axis
 * labels live in the README caption next to each image instead. These are
 * generated previews, not real Plotly/Extension-Host screenshots — same
 * caveat as images/screenshot-{light,dark}.png.
 *
 * Pure Node (zlib only). Run: `node scripts/make-example-previews.mjs`
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

// Inlined from src/core/parse.ts (plain Node can't import the .ts source
// directly) — kept byte-for-byte identical to that module's logic.
function parseXY(text) {
  const datasets = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length === 1) {
      current = { name: line, x: [], y: [] };
      datasets.push(current);
      continue;
    }
    if (parts.length === 2) {
      if (!current) continue;
      const x = parseInt(parts[0], 10);
      const y = parseFloat(parts[1]);
      if (Number.isNaN(x) || Number.isNaN(y)) continue;
      current.x.push(x);
      current.y.push(y);
    }
  }
  return datasets;
}
function parseY(text, baseName) {
  const xs = [], ys = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const y = parseFloat(line);
    if (Number.isNaN(y)) continue;
    ys.push(y);
    xs.push(ys.length);
  }
  return [{ name: baseName, x: xs, y: ys }];
}

// --- tiny canvas: supersampled, antialiased fills/lines/circles ----------

const W = 640, H = 380, SS = 3;
const Wp = W * SS, Hp = H * SS;

function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function makeCanvas() {
  const buf = new Float64Array(Wp * Hp * 4);
  function plot(x, y, [r, g, b], a) {
    if (x < 0 || y < 0 || x >= Wp || y >= Hp || a <= 0) return;
    const i = (y * Wp + x) * 4;
    const inv = 1 - a;
    buf[i] = buf[i] * inv + r * a;
    buf[i + 1] = buf[i + 1] * inv + g * a;
    buf[i + 2] = buf[i + 2] * inv + b * a;
    buf[i + 3] = Math.min(255, buf[i + 3] * inv + 255 * a);
  }
  function rect(x0, y0, x1, y1, color, a = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) plot(x, y, color, a);
  }
  function line(ax, ay, bx, by, color, width, alpha = 1) {
    const hw = width / 2;
    const minX = Math.floor(Math.min(ax, bx) - hw - 1), maxX = Math.ceil(Math.max(ax, bx) + hw + 1);
    const minY = Math.floor(Math.min(ay, by) - hw - 1), maxY = Math.ceil(Math.max(ay, by) + hw + 1);
    const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy || 1;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      let t = ((x - ax) * vx + (y - ay) * vy) / len2;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - (ax + t * vx), y - (ay + t * vy)) - hw;
      const c = Math.min(1, Math.max(0, 0.6 - d)) * alpha;
      if (c > 0) plot(x, y, color, c);
    }
  }
  function circle(cx, cy, r, color) {
    const minX = Math.floor(cx - r - 1), maxX = Math.ceil(cx + r + 1);
    const minY = Math.floor(cy - r - 1), maxY = Math.ceil(cy + r + 1);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const d = Math.hypot(x - cx, y - cy) - r;
      const c = Math.min(1, Math.max(0, 0.6 - d));
      if (c > 0) plot(x, y, color, c);
    }
  }
  return { buf, rect, line, circle };
}

function encodePng(px, w, h) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0, 0);
    return Buffer.concat([len, td, crc]);
  };
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = table[(c ^ b[i]) & 0xff] ^ (c >>> 8); return c ^ 0xffffffff; }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function downsampleAndWrite(buf, path) {
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const i = ((y * SS + sy) * Wp + (x * SS + sx)) * 4;
      r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3];
    }
    const n = SS * SS, o = (y * W + x) * 4;
    out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n); out[o + 2] = Math.round(b / n); out[o + 3] = Math.round(a / n);
  }
  writeFileSync(path, encodePng(out, W, H));
  console.log("wrote " + path);
}

// --- shared chart frame: white background, gridlines, axes ---------------

const MARGIN = { l: 34, r: 18, t: 18, b: 30 };
const PLOT = { x0: MARGIN.l * SS, y0: MARGIN.t * SS, x1: (W - MARGIN.r) * SS, y1: (H - MARGIN.b) * SS };
const GRID = hex("#e3e8ee");
const AXIS = hex("#8a95a3");
const WHITE = hex("#ffffff");

function drawFrame(cv) {
  cv.rect(0, 0, Wp, Hp, WHITE);
  for (let i = 0; i <= 5; i++) {
    const y = PLOT.y0 + ((PLOT.y1 - PLOT.y0) * i) / 5;
    cv.line(PLOT.x0, y, PLOT.x1, y, GRID, 1 * SS);
  }
  cv.line(PLOT.x0, PLOT.y0, PLOT.x0, PLOT.y1, AXIS, 1.5 * SS);
  cv.line(PLOT.x0, PLOT.y1, PLOT.x1, PLOT.y1, AXIS, 1.5 * SS);
}

// --- line plot: examples/match_scan_001.xy --------------------------------

function makeLinePreview() {
  const text = readFileSync("examples/match_scan_001.xy", "utf8");
  const datasets = parseXY(text);
  const palette = ["#1f77b4", "#ff7f0e"];

  const allY = datasets.flatMap((d) => d.y);
  const allX = datasets.flatMap((d) => d.x);
  const xMin = Math.min(...allX), xMax = Math.max(...allX);
  const yMin = Math.min(...allY), yMax = Math.max(...allY);
  const pad = (yMax - yMin) * 0.1 || 1;

  const cv = makeCanvas();
  drawFrame(cv);

  const sx = (x) => PLOT.x0 + ((x - xMin) / (xMax - xMin)) * (PLOT.x1 - PLOT.x0);
  const sy = (y) => PLOT.y1 - ((y - (yMin - pad)) / (yMax + pad - (yMin - pad))) * (PLOT.y1 - PLOT.y0);

  datasets.forEach((d, i) => {
    const color = hex(palette[i % palette.length]);
    for (let k = 0; k < d.x.length - 1; k++) {
      cv.line(sx(d.x[k]), sy(d.y[k]), sx(d.x[k + 1]), sy(d.y[k + 1]), color, 2.2 * SS);
    }
    d.x.forEach((x, k) => cv.circle(sx(x), sy(d.y[k]), 2.4 * SS, color));
  });

  mkdirSync("examples", { recursive: true });
  downsampleAndWrite(cv.buf, "examples/preview-match-scan.png");
}

// --- histogram: examples/measurement_errors.y -----------------------------

// Same binning math the extension used to ship as core/histogram.ts before the
// 3D view (its only caller) was dropped — equal-width bins, index clamped to
// [0, binCount - 1].
function histogramBins(values, binCount) {
  const min = Math.min(...values), max = Math.max(...values);
  const width = (max - min) / binCount || 1;
  const counts = new Array(binCount).fill(0);
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  return counts;
}

function makeHistogramPreview() {
  const text = readFileSync("examples/measurement_errors.y", "utf8");
  const [dataset] = parseY(text, "measurement_errors");
  const bins = 20;
  const counts = histogramBins(dataset.y, bins);
  const maxCount = Math.max(...counts);
  const color = hex("#1f77b4");

  const cv = makeCanvas();
  drawFrame(cv);

  const barGap = 0.14;
  const barW = ((PLOT.x1 - PLOT.x0) / bins) * (1 - barGap);
  counts.forEach((count, i) => {
    const x0 = PLOT.x0 + ((PLOT.x1 - PLOT.x0) * i) / bins + ((PLOT.x1 - PLOT.x0) / bins) * (barGap / 2);
    const h = (count / maxCount) * (PLOT.y1 - PLOT.y0) * 0.94;
    cv.rect(x0, PLOT.y1 - h, x0 + barW, PLOT.y1, color, 0.6);
  });

  downsampleAndWrite(cv.buf, "examples/preview-measurement-errors.png");
}

makeLinePreview();
makeHistogramPreview();
