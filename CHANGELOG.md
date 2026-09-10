# Changelog

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
