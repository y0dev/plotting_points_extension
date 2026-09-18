# Changelog

## 0.4.0 — 2026-09-18

- **Data Files** view now groups files by folder instead of one flat list:
  a file at a workspace root is a plain leaf; anything in a subfolder is
  grouped under a node labeled by that subfolder's relative path. Fixes two
  files sharing a name in different folders reading as identical rows.
- New `xyPlot.ignoreFolders` setting: an array of plain strings checked
  against every directory segment of a file's path (never the file name) —
  a directory is hidden from Data Files if its name *contains* any of the
  terms, case-insensitively. Applies immediately. `node_modules` and `.git`
  are always hidden regardless of this setting.
- `src/core/ignoreFolders.ts`: pure `isIgnoredPath`, unit-tested (8 cases).

## 0.3.1 — 2026-09-18

- Fixed: the "Open a .xy or .y file…" empty-state hint stayed visible over
  the plot even after a file loaded. `#empty-hint`'s own `display: flex`
  rule is an ID selector, which — regardless of source order — beats the
  browser's built-in `[hidden] { display: none }` rule on specificity, so
  toggling `el.hidden` in `main.ts` had no visual effect; the hint (an
  absolutely-positioned overlay, a later sibling of `#plot-div`) stayed
  painted on top of every plot. Added an explicit `#empty-hint[hidden] {
  display: none }` rule in `ui.css` so the attribute toggle actually applies.

## 0.3.0 — 2026-09-18

- `xyPlot.namingRules` edits now apply live: a viewer already open picks up
  an edited rule immediately (checked to the file's exact prefix, e.g.
  `match_scan_*` covering every `match_scan_NNN` file, not just one) without
  closing and reopening the file. Only `namingRules` changes trigger this —
  everything else keeps applying at the next open, as before.
- README restructured: "Config save / load" and "Settings" merged into one
  "Configuration" section with numbered, step-by-step instructions for both
  Save/Load Config and `xyPlot.namingRules`, and an explicit note that
  `xy_plot_config.json` overrides are per-exact-file while `namingRules` is
  the glob-based mechanism for "every file with this prefix."
- New example files: `examples/match_scan_002.xy` (a second file matching the
  `match_scan_*` naming rule, alongside the existing `match_scan_001.xy`) and
  `examples/settings.namingRules.jsonc` (a copy-pasteable `.vscode/settings.json`
  snippet).
- Hover tooltips show a dataset's full name: `layout.hoverlabel.namelength` is
  now `-1`, overriding Plotly's default 15-character truncation.
- New **Data Files** Activity Bar view (`src/views/dataFilesProvider.ts`):
  lists every `.xy` / `.y` file in the workspace, refreshing on its own when
  one is added or removed; clicking an item opens it via `xyPlot.open`. This
  replaces the file list that used to live inside the webview's inspector
  drawer — that list is now scoped to the currently open file's bins,
  legend, dataset colors/labels, and config actions only, not file browsing.
- Removed the modebar's "Download plot as a png" button — it relies on
  triggering a browser file download, which a VS Code webview can't do, so it
  was a button that looked clickable but silently did nothing.
- Zooming: mouse-wheel zoom (`scrollZoom: true`) added, alongside the
  existing click-drag box zoom and the modebar's zoom / pan / box-select /
  lasso-select tools, unchanged.
- Removed the **Load Config** button and the `xyPlot.loadConfig` command —
  loading is `xyPlot.autoLoadConfig`-only now (Save Config is unaffected).
  The `loadConfig` / `requestConfigLoad` protocol messages and their handling
  in `xyPlotEditorProvider.ts` / `main.ts` were removed with it.

## 0.2.0 — 2026-09-18

- Panel chrome redesigned as a native VS Code panel instead of a copy of the
  source browser app's page layout: a thin toolbar (Line / Histogram switch +
  one gear button) with the plot filling the rest of the window; the file
  list, bins & legend, dataset colors/visibility, label fields and config
  actions now live in a slide-out inspector drawer instead of always-visible
  side panels. Flat hairline borders throughout; the drawer is the one
  element with elevation, since it overlays the plot.
- New `xyPlot.namingRules` setting: auto-fill a file's line-mode X/Y labels and
  title from its file name (glob rules, merged across the User/global and
  Workspace/local setting scopes — workspace rules take precedence on
  conflict). An explicit **Set** button edit, once saved, always overrides a
  naming rule.
- `xyPlot.openFolder` now imports: picking a folder from outside the workspace
  copies its `.xy` / `.y` files (never moves, and never overwrites an existing
  copy) into a new `xyPlot.importFolder` setting's folder (default `data/`)
  under the workspace, and opens those copies. Picking a folder already
  inside the workspace is unchanged — it opens in place.
- Two generated preview images added to the README under the `.xy`/`.y`
  format examples (`scripts/make-example-previews.mjs`), computed from the
  real example data.

## 0.1.0

- Initial release. Port of the single-file **XY Plot Viewer** browser app to a
  VS Code custom editor.
- Custom editor for `.xy` / `.y` (priority `option`), with a sibling-folder scan
  to load and switch between the rest.
- Two Plotly views: line plot and overlaid histogram, with a bins control and a
  legend toggle. (The source app's 3D-histogram view is omitted — it required
  Plotly's `scatter3d` trace, which more than doubled the bundle.)
- Datasets & Labels panel: per-dataset color / visibility, Show/Hide All, Reset
  Colors, and editable title / X / Y labels (X / Y per-title in line mode,
  global in histogram).
- Config save / load to a workspace JSON file; optional auto-load of
  `xy_plot_config.json` sitting next to the data.
- Commands: `xyPlot.open`, `xyPlot.openFolder`, `xyPlot.saveConfig`,
  `xyPlot.loadConfig`; explorer context-menu entries for files and folders.
- Settings: `xyPlot.defaultBins`, `xyPlot.defaultView`, `xyPlot.palette`,
  `xyPlot.autoLoadConfig`.
- Fully offline: Plotly (partial `scatter` + `histogram` build, ~1.1 MB) is
  bundled into the webview; CSP forbids all remote/`connect` loads.
- Chrome and the Plotly layout are driven by VS Code theme variables and
  re-render on theme change (light / dark / high-contrast).
