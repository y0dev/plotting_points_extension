# XY Plot Viewer

Open `.xy` / `.y` data files — or a whole folder of them — in a VS Code webview
and plot them with [Plotly.js](https://plotly.com/javascript/): **line plots**
and **overlaid histograms**, with per-dataset color and visibility controls,
editable titles / axis labels, and a save/load-able config.

It is a port of a single-file browser app. The parsing and plotting logic is
carried over unchanged; only the presentation layer is new — a custom editor,
VS Code theme integration, workspace config, commands, and a **fully offline**
Plotly bundle (no CDN). The source app's 3D-histogram view is dropped — it
required Plotly's `scatter3d` trace, which more than doubled the bundle size.

![XY Plot Viewer, light theme](https://raw.githubusercontent.com/y0dev/plotting_points_extension/main/images/screenshot-light.png)

---

## Getting started

| From | Do this |
| --- | --- |
| A single file | Right-click a `.xy` / `.y` file → **Open in XY Plot Viewer**, or *File ▸ Open With… ▸ XY Plot Viewer*. The containing folder is scanned so you can switch between its other data files. |
| A folder | Right-click a folder → **Open Folder in XY Plot Viewer**, or run **XY Plot: Open Folder in XY Plot Viewer** from the Command Palette. |

The custom editor is registered with priority `option`, so it never replaces the
default text editor for `.xy` / `.y` — you opt in per file.

### Build from source

```bash
npm install
npm run build      # esbuild: dist/extension.js + media/webview.js + media/ui.css
npm test           # vitest — the pure core modules
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host.

---

## File formats

`parseDataFile(filename, text)` → `Dataset[]`, where
`Dataset = { name: string; x: number[]; y: number[] }`. The `.y` extension match
is case-insensitive. A dataset's / plot's **original title** is the filename
with the last `.ext` stripped.

### `.xy` — one or more named datasets in a single file

- Split on `\r?\n`, `trim()` each line, skip blank lines.
- Split a line on `\s+`:
  - **1 token** → starts a new dataset; the token is its `name` (`x` / `y` empty).
  - **2 tokens** → `x = parseInt(tok0, 10)`, `y = parseFloat(tok1)`; the pair is
    skipped if either is `NaN`, and ignored entirely if no dataset has started
    yet.
  - **0 or 3+ tokens** → skipped.

```
Match_RunA
1 11.420
2 12.093
MisMatch_RunB
1 11.960
2 12.500
```

### `.y` — one value per line, no names

- `trim()`, skip blanks, `y = parseFloat(line)`, skip `NaN`.
- `x` is the 1-based running index (`1, 2, 3, …`).
- Produces a single dataset named after the file (basename without extension).

```
4.266
-2.539
-3.301
```

Example data lives in [`examples/`](examples/).

---

## The two views

Selected per open plot. **Default:** line for `.xy`, histogram for `.y` (unless
`xyPlot.defaultView` overrides it). Only *visible* datasets are drawn. A **Bins**
input (min 2, max 200) applies to the histogram view.

| View | What it draws |
| --- | --- |
| **Line plot** | One `scatter` trace per visible dataset, `mode: "lines+markers"`, marker size 5, line & marker color = the dataset's resolved color. |
| **Histogram** | One `histogram` trace per visible dataset over that dataset's **y-values**, `nbinsx = bins`, `opacity 0.6`, `barmode: "overlay"`. |

### Datasets & Labels panel

Toggle it from the header. Per dataset: a color swatch (`<input type=color>`
override) and a visibility checkbox, plus a case-insensitive name filter and
**Show All** / **Hide All** / **Reset Colors**.

**Title**, **X-axis label** and **Y-axis label** each have a *Set* button:

- **Title** override is stored per original title.
- In **line** mode, X / Y labels are per-title overrides that fall back to the
  mode's global label. In **histogram** mode they set the mode's global label.

Field defaults: line — `xlabel "Run"`, `ylabel "Value"`; histogram —
`bins 20`, `xlabel "Value"`, `ylabel "Count"`.

The status bar reads `"<file> — <n> dataset(s) — <mode> view"`.

---

## Config save / load

**Save Config** (header button or **XY Plot: Save Config**) writes a JSON file —
by default `.vscode/xy-plot/xy_plot_config.json`, or wherever the Save dialog
points. **Load Config** applies one back (tolerant of missing keys; same
defaults as above; `showLegend` is treated as `!== false`).

```jsonc
{
  "colors": {
    "palette": ["#1f77b4", "#ff7f0e", "..."],
    "dataset_colors": { "<dataset name>": "#rrggbb" }
  },
  "plot_settings":      { "overrides": { "<title>": { "displayTitle": "...", "xlabel": "...", "ylabel": "..." } },
                          "xlabel": "Run", "ylabel": "Value", "showLegend": true },
  "histogram_settings": { "overrides": { "<title>": { "displayTitle": "..." } },
                          "bins": 20, "xlabel": "Value", "ylabel": "Count", "showLegend": true },
  "visibility": { "hidden_names": ["<dataset name>", "..."] }
}
```

The default color palette, cycled by dataset index:

`#1f77b4 #ff7f0e #2ca02c #d62728 #9467bd #8c564b #e377c2 #7f7f7f #bcbd22 #17becf`

A sample is at [`examples/xy_plot_config.json`](examples/xy_plot_config.json).

---

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `xyPlot.defaultBins` | `20` | Initial bin count for the histogram view. |
| `xyPlot.defaultView` | `auto` | `auto` (line for `.xy`, histogram for `.y`), or force `line` / `histogram`. |
| `xyPlot.palette` | 10-color default | Palette cycled by dataset index. |
| `xyPlot.autoLoadConfig` | `false` | If an `xy_plot_config.json` sits next to the data files, load it when the viewer opens. |

Per-file UI state (view mode, panel open, selected file) is remembered in
`workspaceState`, keyed by the file URI.

---

## Offline & safety

- **No network at runtime.** Plotly is bundled into `media/webview.js` as a
  partial build — only the `scatter` and `histogram` trace modules are
  registered (~1.1 MB instead of ~3.5 MB). The webview CSP sets
  `default-src 'none'` and `connect-src 'none'`, scripts load only from a
  nonce'd tag, and `localResourceRoots` is limited to `media/`. (`script-src`
  additionally allows `'unsafe-eval'`, which the bundled Plotly needs; no data
  or config file is ever routed through an eval path.)
- **No code execution from data or config files** — plain text parsing and
  `JSON.parse` only.
- **Read-only** with respect to the data: the extension never rewrites `.xy` /
  `.y` files.

---

## Theming

All chrome and the Plotly layout are driven by VS Code theme variables
(`--vscode-editor-background`, `--vscode-foreground`, `--vscode-panel-border`,
`--vscode-focusBorder`, …), so the viewer works in light, dark and
high-contrast themes and re-renders when you switch themes.

![XY Plot Viewer, dark theme](https://raw.githubusercontent.com/y0dev/plotting_points_extension/main/images/screenshot-dark.png)

### Capturing screenshots

`images/screenshot-light.png` and `images/screenshot-dark.png` ship as
**placeholders** (generated by `node scripts/make-screenshots.mjs`). To replace
them with real captures:

1. <kbd>F5</kbd> to launch the Extension Development Host.
2. Open `examples/match_scan_001.xy`; open the Datasets & Labels panel.
3. Set the color theme to a light theme (e.g. *Light Modern*), then
   *Developer: Capture Screenshot* (or your OS tool) → save as
   `images/screenshot-light.png`.
4. Switch to a dark theme (e.g. *Dark Modern*) and repeat →
   `images/screenshot-dark.png`.

---

## Architecture

```
src/core/     pure — no vscode, no DOM. parseXY / parseY / parseDataFile,
              color config, title/label overrides, visibility,
              config serialize/deserialize. Ported from the source app and
              unit-tested (test/).
src/webview/  panel UI + Plotly wiring: renderLine / renderHistogram /
              baseLayout / plotlyConfig, the DOM & event glue, theme
              resolution, the partial Plotly bundle.
src/editor/   the CustomTextEditorProvider (webview HTML + CSP + nonce,
              sibling-folder scan, workspaceState, config auto-load, message pump)
              and the HTML template.
src/commands/ open, openFolder, saveConfig, loadConfig.
src/protocol.ts   typed host <-> webview messages.
```

Build: `esbuild.mjs` emits a Node/CJS bundle for the extension host and a
browser/IIFE bundle (with Plotly) for the webview, and copies `ui.css`
alongside Plotly's `webview.css`.

## License

MIT — see [LICENSE](LICENSE).
