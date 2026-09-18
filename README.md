# XY Plot Viewer

Open `.xy` / `.y` data files — or a whole folder of them — in a VS Code webview
and plot them with [Plotly.js](https://plotly.com/javascript/): **line plots**
and **overlaid histograms**, with per-dataset color and visibility controls,
editable titles / axis labels, file-name-driven label defaults, and a
save/load-able config.

The parsing and plotting math is a port of a single-file browser app; the
panel itself is not — it's a purpose-built VS Code panel (a thin toolbar +
slide-out inspector, see below), not the source app's page layout. VS Code
theme integration, workspace config, commands, and a **fully offline** Plotly
bundle (no CDN) round it out. The source app's 3D-histogram view is dropped —
it required Plotly's `scatter3d` trace, which more than doubled the bundle
size.

![XY Plot Viewer, light theme](https://raw.githubusercontent.com/y0dev/plotting_points_extension/main/images/screenshot-light.png)

---

## Getting started

| From | Do this |
| --- | --- |
| A single file | Right-click a `.xy` / `.y` file → **Open in XY Plot Viewer**, or *File ▸ Open With… ▸ XY Plot Viewer*. The containing folder is scanned so you can switch between its other data files. |
| A folder | Right-click a folder → **Open Folder in XY Plot Viewer**, or run **XY Plot: Open Folder in XY Plot Viewer** from the Command Palette. If you pick a folder from outside the workspace (an instrument's output folder, Downloads, …), its `.xy` / `.y` files are copied into the project first — see [Importing from outside the workspace](#importing-from-outside-the-workspace). |

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

![Line plot of examples/match_scan_001.xy — Match_RunA in blue, MisMatch_RunB in orange, both crossing around the midpoint](https://raw.githubusercontent.com/y0dev/plotting_points_extension/main/examples/preview-match-scan.png)

### `.y` — one value per line, no names

- `trim()`, skip blanks, `y = parseFloat(line)`, skip `NaN`.
- `x` is the 1-based running index (`1, 2, 3, …`).
- Produces a single dataset named after the file (basename without extension).

```
4.266
-2.539
-3.301
```

![Histogram of examples/measurement_errors.y — 240 values in 20 bins, roughly split around zero](https://raw.githubusercontent.com/y0dev/plotting_points_extension/main/examples/preview-measurement-errors.png)

Example data lives in [`examples/`](examples/). The two images above are
generated previews (`node scripts/make-example-previews.mjs`) computed from
the real example data with the same axis/gridline conventions the extension
uses — not a captured screenshot, so there's no title/axis text baked in; for
what the actual panel looks like, see the screenshots above and under
[Theming](#theming).

---

## The two views

Selected per open plot. **Default:** line for `.xy`, histogram for `.y` (unless
`xyPlot.defaultView` overrides it). Only *visible* datasets are drawn. A **Bins**
input (min 2, max 200) applies to the histogram view.

| View | What it draws |
| --- | --- |
| **Line plot** | One `scatter` trace per visible dataset, `mode: "lines+markers"`, marker size 5, line & marker color = the dataset's resolved color. |
| **Histogram** | One `histogram` trace per visible dataset over that dataset's **y-values**, `nbinsx = bins`, `opacity 0.6`, `barmode: "overlay"`. |

### The inspector

The toolbar is deliberately minimal: a Line / Histogram switch and one gear
button. Everything else — the file list, bins & legend, dataset colors /
visibility, and the label fields below — lives in the inspector, a drawer that
slides in from the right when you click the gear (and back out when you click
it again); the plot fills the rest of the window either way.

Inside it, per dataset: a color swatch (`<input type=color>` override) and a
visibility checkbox, plus a case-insensitive name filter and
**Show All** / **Hide All** / **Reset Colors**.

**Title**, **X-axis label** and **Y-axis label** each have a *Set* button:

- **Title** override is stored per original title.
- In **line** mode, X / Y labels are per-title overrides that fall back to a
  file-name match in `xyPlot.namingRules` (see [Settings](#settings)), then to
  the mode's global label. In **histogram** mode they set the mode's global
  label directly — histogram's label is shared by every loaded file, so
  per-file naming rules don't apply there.

Field defaults: line — `xlabel "Run"`, `ylabel "Value"`; histogram —
`bins 20`, `xlabel "Value"`, `ylabel "Count"`.

The status bar reads `"<file> — <n> dataset(s) — <mode> view"`.

---

## Config save / load

**Save Config** (inspector button or **XY Plot: Save Config**) writes a JSON file —
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
| `xyPlot.namingRules` | `[]` | Auto-fill a file's line-mode X/Y labels and title by file name — see below. |
| `xyPlot.importFolder` | `"data"` | Where **Open Folder** copies files to when the folder you pick is outside the workspace — see below. |

Per-file UI state (view mode, inspector open, selected file) is remembered in
`workspaceState`, keyed by the file URI.

### Importing from outside the workspace

`XY Plot: Open Folder in XY Plot Viewer` treats "inside" and "outside" the
workspace differently:

- **Inside** the workspace (including every use from the explorer
  right-click, since that folder is by definition already part of it) — opens
  in place, same as always. Nothing is copied.
- **Outside** the workspace — the folder's `.xy` / `.y` files are **copied**
  (never moved; the originals are left exactly where they were) into
  `xyPlot.importFolder` under the first workspace folder, creating it if
  needed, and it's those copies that open. A file already present at the
  destination is left as-is, not overwritten, so re-importing the same source
  folder only pulls in what's new.
- No workspace open at all → there's nowhere to import into, so it falls back
  to opening the original folder in place (with a warning).

### `xyPlot.namingRules` — label a file by its name, not by hand

An array of `{ match, xlabel?, ylabel?, title? }`. `match` is a small glob
(only `*` is special) checked case-insensitively against a file's **original
title** — its name with the extension stripped. Rules are checked in array
order; when more than one matches, later rules override earlier ones
field-by-field (not whole-rule replacement), so a broad rule can set a default
and a narrower one just override one field:

```jsonc
// settings.json — global (User) or this workspace's .vscode/settings.json (local)
"xyPlot.namingRules": [
  { "match": "*", "xlabel": "Value" },
  { "match": "match_scan_*", "xlabel": "Scan Position", "ylabel": "Signal Amplitude" },
  { "match": "*_noise", "ylabel": "Noise (mV)" }
]
```

Set it in **User settings** for a rule that should apply to every workspace,
or in **this workspace's** `.vscode/settings.json` for project-specific rules
— unlike a normal VS Code setting, the two are *merged* here (User rules
first, Workspace rules appended and taking precedence on conflict), not one
replacing the other.

A label set through the inspector's **Set** buttons and saved to
`xy_plot_config.json` always wins over a naming rule — naming rules only fill
in a default, they never override something you typed.

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
2. Open `examples/match_scan_001.xy`; click the gear icon to open the inspector.
3. Set the color theme to a light theme (e.g. *Light Modern*), then
   *Developer: Capture Screenshot* (or your OS tool) → save as
   `images/screenshot-light.png`.
4. Switch to a dark theme (e.g. *Dark Modern*) and repeat →
   `images/screenshot-dark.png`.

---

## Architecture

```
src/core/     pure — no vscode, no DOM. parseXY / parseY / parseDataFile,
              color config, title/label overrides, visibility, naming-rule
              matching (namingRules.ts), config serialize/deserialize. Ported
              from the source app (parsing/plotting math) and unit-tested
              (test/); namingRules.ts and the panel chrome are new, not ported.
src/webview/  panel UI + Plotly wiring: renderLine / renderHistogram /
              baseLayout / plotlyConfig, the DOM & event glue (toolbar, the
              inspector drawer), theme resolution, the partial Plotly bundle.
src/editor/   the CustomTextEditorProvider (webview HTML + CSP + nonce,
              sibling-folder scan, workspaceState, config auto-load, naming-rule
              scope merging, message pump) and the HTML template.
src/commands/ open, openFolder, saveConfig, loadConfig.
src/protocol.ts   typed host <-> webview messages.
```

Build: `esbuild.mjs` emits a Node/CJS bundle for the extension host and a
browser/IIFE bundle (with Plotly) for the webview, and copies `ui.css`
alongside Plotly's `webview.css`.

---

## Versions

| Version | Highlights |
| --- | --- |
| 0.2.0 | Native-inspector redesign (toolbar + slide-out drawer, replacing the ported page layout); `xyPlot.namingRules` — auto-fill axis labels/title by file name. |
| 0.1.0 | Initial release: line + histogram views, Datasets & Labels panel, config save/load, offline Plotly bundle. |

Full details in [CHANGELOG.md](CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE).
