/**
 * Plotly render functions. The trace/layout construction is ported faithfully
 * from the source browser app (xy_plot_viewer.html); the only change is that
 * colors that were hard-coded light values there (`paper_bgcolor`,
 * `plot_bgcolor`, `font.color`, axis `gridcolor`) are now driven by the VS Code
 * theme via the `theme` argument.
 *
 * The source app's 3D-histogram view (`renderHistogram3D`) is not included —
 * it required Plotly's `scatter3d` trace, which dominated the bundle size.
 */
import type { Dataset } from "../core/parse";
import { getColor, ColorConfig } from "../core/colorConfig";
import Plotly from "./plotly";

export interface Theme {
  /** editor background — `--vscode-editor-background` */
  bg: string;
  /** foreground — `--vscode-foreground` */
  fg: string;
  /** translucent foreground for grid lines */
  grid: string;
}

/** One visible dataset plus its original index (for palette cycling). */
export interface IndexedDataset {
  dataset: Dataset;
  index: number;
}

export interface LineOpts {
  visible: IndexedDataset[];
  colors: ColorConfig;
  xlabel: string;
  ylabel: string;
  showLegend: boolean;
  theme: Theme;
}

export interface HistogramOpts extends LineOpts {
  bins: number;
}

export function baseLayout(title: string, showLegend: boolean, theme: Theme): Record<string, unknown> {
  return {
    title: { text: title, font: { size: 15 } },
    showlegend: !!showLegend,
    margin: { t: 48, l: 60, r: 20, b: 50 },
    paper_bgcolor: theme.bg,
    plot_bgcolor: theme.bg,
    font: { family: "-apple-system, Segoe UI, sans-serif", size: 12, color: theme.fg },
    // Plotly truncates a trace's name in its hover label to 15 characters by
    // default (namelength); -1 shows the full dataset name regardless of length.
    hoverlabel: { namelength: -1 },
  };
}

export function plotlyConfig(): Record<string, unknown> {
  return {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: [
      // "Download plot as a png" doesn't work inside a VS Code webview — it
      // relies on triggering a browser file download, which the webview
      // sandbox doesn't support.
      "toImage",
      // Box/lasso select mark points as "selected" and fire a
      // plotly_selected event for a page's own JS to act on — nothing here
      // listens for it, so dragging one just dims the unselected points
      // with no further effect. Removed rather than left looking clickable
      // for no payoff.
      "select2d",
      "lasso2d",
    ],
    // Mouse-wheel zoom, on top of the modebar's zoom/pan tools and
    // click-drag box zoom, both left at their Plotly defaults — this only
    // adds an easier way in, it doesn't replace them.
    scrollZoom: true,
  };
}

export function renderLine(root: HTMLElement, title: string, opts: LineOpts): void {
  const { visible, colors, theme } = opts;
  const traces = visible.map(({ dataset, index }) => ({
    x: dataset.x,
    y: dataset.y,
    type: "scatter",
    mode: "lines+markers",
    name: dataset.name,
    line: { color: getColor(colors, dataset.name, index) },
    marker: { color: getColor(colors, dataset.name, index), size: 5 },
  }));

  const layout = baseLayout(title, opts.showLegend, theme);
  layout.xaxis = { title: opts.xlabel, gridcolor: theme.grid };
  layout.yaxis = { title: opts.ylabel, gridcolor: theme.grid };

  Plotly.react(root, traces, layout, plotlyConfig());
}

export function renderHistogram(root: HTMLElement, title: string, opts: HistogramOpts): void {
  const { visible, colors, bins, theme } = opts;
  const traces = visible.map(({ dataset, index }) => ({
    x: dataset.y,
    type: "histogram",
    nbinsx: bins,
    opacity: 0.6,
    name: dataset.name,
    marker: { color: getColor(colors, dataset.name, index) },
  }));

  const layout = baseLayout(title, opts.showLegend, theme);
  layout.barmode = "overlay";
  layout.xaxis = { title: opts.xlabel, gridcolor: theme.grid };
  layout.yaxis = { title: opts.ylabel, gridcolor: theme.grid };

  Plotly.react(root, traces, layout, plotlyConfig());
}

export function purge(root: HTMLElement): void {
  Plotly.purge(root);
}
