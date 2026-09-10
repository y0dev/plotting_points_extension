/**
 * Builds the webview HTML. The markup mirrors the source browser app
 * (xy_plot_viewer.html) so the ported webview script can bind the same element
 * IDs; styling comes from `ui.css` and everything is theme-driven.
 */

export interface TemplateUris {
  /** `webview.cspSource` */
  cspSource: string;
  nonce: string;
  scriptUri: string;
  /** `media/ui.css` — the panel chrome. */
  styleUri: string;
  /** `media/webview.css` — Plotly's stylesheet, emitted alongside the bundle. */
  plotlyStyleUri: string;
}

const ICON_SVG = `
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="100" height="100" rx="22" fill="#155a8a"/>
    <polyline points="10,55 30,35 50,45 70,20 90,30" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="10,72 30,62 50,68 70,52 90,60" fill="none" stroke="#ff7f0e" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

export function renderTemplate(u: TemplateUris): string {
  // `script-src` also allows 'unsafe-eval': the bundled Plotly build needs it
  // (some of its numeric/gl code paths use Function()). No data or config file
  // is ever routed through an eval path — parsing is pure string ops + JSON.parse
  // — so the "no code execution from data files" guarantee is unaffected.
  // `connect-src 'none'` still blocks every network request.
  const csp = [
    `default-src 'none'`,
    `img-src ${u.cspSource} data:`,
    `style-src ${u.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${u.nonce}' 'unsafe-eval'`,
    `font-src ${u.cspSource}`,
    `connect-src 'none'`,
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>XY Plot Viewer</title>
<link rel="stylesheet" href="${u.plotlyStyleUri}">
<link rel="stylesheet" href="${u.styleUri}">
</head>
<body>

<header>
  <div class="icon">${ICON_SVG}</div>
  <div>
    <h1>XY Plot Viewer</h1>
    <p>Line plots &amp; overlaid histograms for .xy / .y data — fully offline</p>
  </div>
  <div class="menu">
    <button class="btn" id="show-labels-btn">Datasets &amp; Labels ▾</button>
    <button class="btn" id="save-config-btn">Save Config</button>
    <button class="btn" id="load-config-btn">Load Config</button>
  </div>
</header>

<main>
  <section class="panel" id="files-panel">
    <h2>Data Files</h2>
    <div id="folder-hint">No files loaded.</div>
    <div id="file-list"><div class="empty">No files loaded.</div></div>

    <fieldset>
      <legend>View</legend>
      <div class="hint" style="margin-bottom:6px;">Defaults to line plot for .xy and histogram for .y — switch anytime.</div>
      <div class="radio-row"><input type="radio" name="view-mode" id="view-line" value="line"><label for="view-line">Line Plot</label></div>
      <div class="radio-row"><input type="radio" name="view-mode" id="view-hist" value="histogram"><label for="view-hist">Histogram</label></div>
      <div class="field-row" style="margin-top:8px;">
        <label for="bins-input">Bins:</label>
        <input type="number" id="bins-input" min="2" max="200" value="20">
      </div>
    </fieldset>

    <fieldset>
      <legend>Legend</legend>
      <div class="radio-row"><input type="checkbox" id="legend-toggle" checked><label for="legend-toggle">Show legend</label></div>
    </fieldset>
  </section>

  <section class="panel" id="labels-panel">
    <h2>Datasets &amp; Labels</h2>
    <div class="hint">Check a dataset to show it in the plot &amp; legend.<br>Click its swatch to override its color.</div>

    <input type="text" id="dataset-filter" placeholder="Filter datasets…">
    <div class="btn-row" style="margin-bottom:8px;">
      <button class="btn" id="show-all-btn">Show All</button>
      <button class="btn" id="hide-all-btn">Hide All</button>
    </div>
    <div id="dataset-list"></div>
    <div class="btn-row" style="margin-top:8px;">
      <button class="btn" id="reset-colors-btn">Reset Colors</button>
    </div>

    <div class="section-heading">Title for this plot</div>
    <input type="text" id="title-input">
    <button class="btn" id="set-title-btn" style="margin-top:6px; width:100%;">Set Title</button>

    <div class="section-heading">X-axis label</div>
    <input type="text" id="xlabel-input">
    <button class="btn" id="set-xlabel-btn" style="margin-top:6px; width:100%;">Set X Label</button>

    <div class="section-heading">Y-axis label</div>
    <input type="text" id="ylabel-input">
    <button class="btn" id="set-ylabel-btn" style="margin-top:6px; width:100%;">Set Y Label</button>
  </section>

  <section class="panel" id="plot-panel">
    <h2>Plot</h2>
    <div id="plot-div"></div>
  </section>
</main>

<footer id="status-bar">No file selected.</footer>

<script nonce="${u.nonce}" src="${u.scriptUri}"></script>
</body>
</html>`;
}

/** URL-safe random nonce for the CSP `script-src`. */
export function makeNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
