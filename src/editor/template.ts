/**
 * Builds the webview HTML. The chrome here is a purpose-built VS Code panel,
 * not a port of the source browser app's page layout: a thin toolbar (view
 * switch + inspector toggle), the plot filling the rest of the space, and
 * everything else — file list, bins & legend, dataset colors/labels, config
 * actions — tucked into a slide-out inspector drawer, in the spirit of VS
 * Code's own Explorer / Outline side panels. Styling comes from `ui.css` and
 * every color is theme-driven.
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

/** Small inline icons, stroked with `currentColor` so they follow the theme. */
const ICONS = {
  brand: `<svg viewBox="0 0 100 100" width="18" height="18" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="8,58 30,36 50,46 72,18 92,30"/></svg>`,
  line: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3,17 9,10 13,14 21,5"/></svg>`,
  histogram: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="20" x2="5" y2="11"/><line x1="10" y1="20" x2="10" y2="4"/><line x1="15" y1="20" x2="15" y2="14"/><line x1="20" y1="20" x2="20" y2="8"/></svg>`,
  inspector: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="7" cy="18" r="2" fill="currentColor" stroke="none"/></svg>`,
};

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

<div id="app">
  <header id="toolbar">
    <span class="brand" title="XY Plot Viewer">${ICONS.brand}</span>

    <div id="view-switch" role="group" aria-label="View mode">
      <button type="button" id="view-line-btn" class="view-btn active" aria-pressed="true">
        ${ICONS.line}<span>Line</span>
      </button>
      <button type="button" id="view-hist-btn" class="view-btn" aria-pressed="false">
        ${ICONS.histogram}<span>Histogram</span>
      </button>
    </div>

    <div class="toolbar-spacer"></div>

    <button type="button" id="inspector-toggle-btn" class="icon-btn" title="Files, datasets &amp; config"
            aria-expanded="false" aria-controls="inspector">
      ${ICONS.inspector}
    </button>
  </header>

  <main id="stage">
    <div id="plot-div"></div>
    <div id="empty-hint" class="hint" hidden>
      Open a .xy or .y file, or use the panel (top right) to load a folder.
    </div>
  </main>

  <footer id="status-bar">No file selected.</footer>

  <aside id="inspector" aria-hidden="true" aria-label="Files, datasets and config">
    <div class="inspector-scroll">
      <section class="inspector-section">
        <h2>Data Files</h2>
        <div id="folder-hint" class="hint">No files loaded.</div>
        <div id="file-list"><div class="empty">No files loaded.</div></div>
      </section>

      <section class="inspector-section">
        <h2>Bins &amp; Legend</h2>
        <div class="field-row">
          <label for="bins-input">Bins</label>
          <input type="number" id="bins-input" min="2" max="200" value="20">
        </div>
        <label class="check-row"><input type="checkbox" id="legend-toggle" checked> Show legend</label>
      </section>

      <section class="inspector-section">
        <h2>Datasets &amp; Labels</h2>
        <div class="hint">Check a dataset to show it in the plot &amp; legend.<br>Click its swatch to override its color.</div>

        <input type="text" id="dataset-filter" placeholder="Filter datasets…">
        <div class="btn-row">
          <button class="btn" id="show-all-btn">Show All</button>
          <button class="btn" id="hide-all-btn">Hide All</button>
        </div>
        <div id="dataset-list"></div>
        <button class="btn btn-block" id="reset-colors-btn">Reset Colors</button>

        <div class="field-stack">
          <label class="field-label" for="title-input">Title</label>
          <input type="text" id="title-input">
          <button class="btn btn-block" id="set-title-btn">Set Title</button>

          <label class="field-label" for="xlabel-input">X-axis label</label>
          <input type="text" id="xlabel-input">
          <button class="btn btn-block" id="set-xlabel-btn">Set X Label</button>

          <label class="field-label" for="ylabel-input">Y-axis label</label>
          <input type="text" id="ylabel-input">
          <button class="btn btn-block" id="set-ylabel-btn">Set Y Label</button>
        </div>

        <div class="hint">Labels can also be auto-filled by file name via the
          <code>xyPlot.namingRules</code> setting — this panel's Set buttons
          always take priority over it.</div>
      </section>

      <section class="inspector-section">
        <h2>Config</h2>
        <div class="btn-row">
          <button class="btn" id="save-config-btn">Save Config</button>
          <button class="btn" id="load-config-btn">Load Config</button>
        </div>
      </section>
    </div>
  </aside>
</div>

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
