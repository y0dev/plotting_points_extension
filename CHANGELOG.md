# Changelog

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
