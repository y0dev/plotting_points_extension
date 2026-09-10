/**
 * File-format parsing. Ported verbatim from the source browser app
 * (xy_plot_viewer.html) — the parsing math must not change.
 */

export interface Dataset {
  name: string;
  x: number[];
  y: number[];
}

/**
 * `.xy` — one or more named datasets in a single file.
 * - Split on `\r?\n`, `trim()` each line, skip blank lines.
 * - Split a line on `\s+`:
 *   - 1 token  → starts a new dataset; the token is its `name`.
 *   - 2 tokens → `x = parseInt(tok0, 10)`, `y = parseFloat(tok1)`; skip the pair
 *     if either is `NaN`; ignore entirely if no dataset has started yet.
 *   - 0 or 3+ tokens → skipped.
 */
export function parseXY(text: string): Dataset[] {
  const datasets: Dataset[] = [];
  let current: Dataset | null = null;
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
    // 0 or 3+ tokens: skipped
  }
  return datasets;
}

/**
 * `.y` — one value per line, no names.
 * - `trim()`, skip blanks, `y = parseFloat(line)`, skip `NaN`.
 * - `x` is the 1-based running index.
 * - Produces a single dataset named `baseName`.
 */
export function parseY(text: string, baseName: string): Dataset[] {
  const xs: number[] = [];
  const ys: number[] = [];
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

/**
 * Route by extension. `.y` matching is case-insensitive; the dataset / plot
 * "original title" is the filename with the last `.ext` stripped.
 */
export function parseDataFile(filename: string, text: string): Dataset[] {
  const base = filename.replace(/\.[^/.]+$/, "");
  if (filename.toLowerCase().endsWith(".y")) return parseY(text, base);
  return parseXY(text);
}
