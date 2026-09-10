/**
 * Partial Plotly build: the core plus only the trace types the two views need
 * (`scatter` for the line plot, `histogram` for the overlaid histogram).
 * Bundled into `media/webview.js` by esbuild so the webview loads no remote
 * assets. `scatter3d` and Plotly's gl3d subplot code are deliberately excluded
 * — that alone is ~600 KB of the bundle.
 *
 * The partial entry points (`plotly.js/lib/*`) ship no type declarations, so
 * they are imported untyped and the small surface actually used is re-typed via
 * {@link PlotlyPartial}.
 */
// @ts-ignore — no type declarations for the partial entry point
import PlotlyCore from "plotly.js/lib/core";
// @ts-ignore
import scatter from "plotly.js/lib/scatter";
// @ts-ignore
import histogram from "plotly.js/lib/histogram";

export interface PlotlyPartial {
  react(
    root: HTMLElement,
    data: unknown[],
    layout?: unknown,
    config?: unknown,
  ): Promise<HTMLElement>;
  purge(root: HTMLElement): void;
  register(modules: unknown): void;
}

const Plotly = PlotlyCore as PlotlyPartial;
Plotly.register([scatter, histogram]);

export default Plotly;
