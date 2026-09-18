/**
 * Webview entry point: the panel UI and Plotly wiring. The application `state`
 * object and the `renderPlot` control flow are ported from the source browser
 * app (xy_plot_viewer.html); the file `<input>` is replaced by messages from
 * the extension host, and Save / Load Config round-trip through the host so
 * they touch the workspace, not a download.
 *
 * The chrome itself is not a port of the source app's layout: there is one
 * toolbar (view switch + inspector toggle), the plot fills the rest of the
 * space, and bins & legend / dataset labels / config actions live in a
 * single slide-out inspector drawer instead of always-visible side panels.
 * The file list itself lives outside the webview entirely, in the "Data
 * Files" Activity Bar view (src/views/dataFilesProvider.ts).
 */
import type {
  HostToWebview,
  UiState,
  ViewMode,
  WebviewToHost,
} from "../protocol";
import { parseDataFile, type Dataset } from "../core/parse";
import {
  makeColorConfig,
  getColor,
  setColor,
  clearAllColors,
} from "../core/colorConfig";
import {
  makeTitleSettings,
  resolveDisplayTitle,
  getFieldOr,
  setOverrideField,
} from "../core/titleSettings";
import {
  makeVisibility,
  isVisible,
  setVisible,
  showAllVisible,
  hideAllVisible,
} from "../core/visibility";
import {
  serializeConfig,
  deserializeConfig,
  type PlotState,
} from "../core/config";
import { resolveNamingLabels, type NamingRule } from "../core/namingRules";
import {
  renderLine,
  renderHistogram,
  purge,
  type IndexedDataset,
} from "./render";
import { readTheme } from "./theme";

declare function acquireVsCodeApi(): {
  postMessage(msg: WebviewToHost): void;
  getState(): unknown;
  setState(state: unknown): void;
};
const vscode = acquireVsCodeApi();
function post(msg: WebviewToHost): void {
  vscode.postMessage(msg);
}

/* =========================================================================
   APPLICATION STATE  (ported from xy_plot_viewer.html)
   ========================================================================= */

interface LoadedFile {
  name: string;
  datasets: Dataset[];
}

const state = {
  files: [] as LoadedFile[],
  currentIndex: -1,
  viewMode: "line" as ViewMode,
  colors: makeColorConfig(),
  plotSettings: makeTitleSettings({ xlabel: "Run", ylabel: "Value", showLegend: true }),
  histSettings: makeTitleSettings({ bins: 20, xlabel: "Value", ylabel: "Count", showLegend: true }),
  visibility: makeVisibility(),
  namingRules: [] as NamingRule[],
};

/** `state` typed as the slice the config module reads / writes. */
const configView = state as unknown as PlotState;

/** How new file selections pick their view; `auto` = per-extension rule. */
let defaultView: ViewMode | "auto" = "auto";
let inspectorOpen = false;

function currentFile(): LoadedFile | null {
  return state.currentIndex >= 0 ? state.files[state.currentIndex] : null;
}
function currentSettings() {
  if (state.viewMode === "histogram") return state.histSettings;
  return state.plotSettings;
}
function originalTitleFor(file: LoadedFile): string {
  return file.name.replace(/\.[^/.]+$/, "");
}

/* =========================================================================
   DOM ELEMENTS
   ========================================================================= */

const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const el = {
  viewLineBtn: $<HTMLButtonElement>("view-line-btn"),
  viewHistBtn: $<HTMLButtonElement>("view-hist-btn"),
  binsInput: $<HTMLInputElement>("bins-input"),
  legendToggle: $<HTMLInputElement>("legend-toggle"),
  inspectorToggleBtn: $<HTMLButtonElement>("inspector-toggle-btn"),
  inspector: $("inspector"),
  datasetFilter: $<HTMLInputElement>("dataset-filter"),
  datasetList: $("dataset-list"),
  showAllBtn: $<HTMLButtonElement>("show-all-btn"),
  hideAllBtn: $<HTMLButtonElement>("hide-all-btn"),
  resetColorsBtn: $<HTMLButtonElement>("reset-colors-btn"),
  titleInput: $<HTMLInputElement>("title-input"),
  setTitleBtn: $<HTMLButtonElement>("set-title-btn"),
  xlabelInput: $<HTMLInputElement>("xlabel-input"),
  setXlabelBtn: $<HTMLButtonElement>("set-xlabel-btn"),
  ylabelInput: $<HTMLInputElement>("ylabel-input"),
  setYlabelBtn: $<HTMLButtonElement>("set-ylabel-btn"),
  plotDiv: $("plot-div"),
  emptyHint: $("empty-hint"),
  statusBar: $("status-bar"),
  saveConfigBtn: $<HTMLButtonElement>("save-config-btn"),
};

/* =========================================================================
   FILE SELECTION
   (the visible file list itself now lives in the "Data Files" Activity Bar
   view — src/views/dataFilesProvider.ts — not in the webview; each file still
   opens in its own editor tab, and sibling files loaded here are only used to
   pick the one to show, per uiState / the primary file that was opened.)
   ========================================================================= */

function viewForFile(file: LoadedFile): ViewMode {
  if (defaultView !== "auto") return defaultView;
  return file.name.toLowerCase().endsWith(".y") ? "histogram" : "line";
}

function selectFile(index: number, keepViewMode = false): void {
  state.currentIndex = index;
  const file = state.files[index];
  if (!keepViewMode) state.viewMode = viewForFile(file);
  syncViewButtons();
  renderPlot();
  persistUiState();
}

/* =========================================================================
   VIEW MODE / BINS / LEGEND CONTROLS
   ========================================================================= */

function syncViewButtons(): void {
  el.viewLineBtn.classList.toggle("active", state.viewMode === "line");
  el.viewLineBtn.setAttribute("aria-pressed", String(state.viewMode === "line"));
  el.viewHistBtn.classList.toggle("active", state.viewMode === "histogram");
  el.viewHistBtn.setAttribute("aria-pressed", String(state.viewMode === "histogram"));
}

function setViewMode(mode: ViewMode): void {
  if (state.viewMode === mode) return;
  state.viewMode = mode;
  syncViewButtons();
  renderPlot();
  persistUiState();
}

el.viewLineBtn.addEventListener("click", () => setViewMode("line"));
el.viewHistBtn.addEventListener("click", () => setViewMode("histogram"));

el.binsInput.addEventListener("change", () => {
  const bins = parseInt(el.binsInput.value, 10);
  if (Number.isNaN(bins) || bins < 1) return;
  if (state.viewMode === "histogram") state.histSettings.bins = bins;
  renderPlot();
});

el.legendToggle.addEventListener("change", () => {
  currentSettings().showLegend = el.legendToggle.checked;
  renderPlot();
});

/* =========================================================================
   INSPECTOR DRAWER (files, bins & legend, datasets & labels, config)
   ========================================================================= */

function setInspectorOpen(open: boolean): void {
  inspectorOpen = open;
  el.inspector.classList.toggle("open", open);
  el.inspector.setAttribute("aria-hidden", String(!open));
  el.inspectorToggleBtn.classList.toggle("active", open);
  el.inspectorToggleBtn.setAttribute("aria-expanded", String(open));
}

el.inspectorToggleBtn.addEventListener("click", () => {
  setInspectorOpen(!inspectorOpen);
  persistUiState();
});

el.datasetFilter.addEventListener("input", renderDatasetList);

function renderDatasetList(): void {
  el.datasetList.innerHTML = "";
  const file = currentFile();
  if (!file) return;

  const filterText = el.datasetFilter.value.trim().toLowerCase();

  file.datasets.forEach((dataset, index) => {
    if (filterText && !dataset.name.toLowerCase().includes(filterText)) return;

    const row = document.createElement("div");
    row.className = "dataset-row";

    const swatch = document.createElement("input");
    swatch.type = "color";
    swatch.className = "swatch";
    swatch.value = getColor(state.colors, dataset.name, index);
    swatch.title = "Click to set a color for " + dataset.name;
    swatch.addEventListener("input", () => {
      setColor(state.colors, dataset.name, swatch.value);
      renderPlot();
    });

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isVisible(state.visibility, dataset.name);
    checkbox.addEventListener("change", () => {
      setVisible(state.visibility, dataset.name, checkbox.checked);
      renderPlot();
    });

    const label = document.createElement("label");
    label.textContent = dataset.name;

    row.appendChild(swatch);
    row.appendChild(checkbox);
    row.appendChild(label);
    el.datasetList.appendChild(row);
  });
}

el.showAllBtn.addEventListener("click", () => {
  const file = currentFile();
  if (!file) return;
  showAllVisible(state.visibility, file.datasets.map((d) => d.name));
  renderDatasetList();
  renderPlot();
});

el.hideAllBtn.addEventListener("click", () => {
  const file = currentFile();
  if (!file) return;
  hideAllVisible(state.visibility, file.datasets.map((d) => d.name));
  renderDatasetList();
  renderPlot();
});

el.resetColorsBtn.addEventListener("click", () => {
  clearAllColors(state.colors);
  renderDatasetList();
  renderPlot();
});

/* ---- title / x / y label fields ---------------------------------------- */

el.setTitleBtn.addEventListener("click", () => {
  const file = currentFile();
  if (!file) return;
  const title = originalTitleFor(file);
  currentSettings().overrides[title] = currentSettings().overrides[title] || {};
  setOverrideField(currentSettings(), title, "displayTitle", el.titleInput.value);
  renderPlot();
});

el.setXlabelBtn.addEventListener("click", () => {
  const file = currentFile();
  if (!file) return;
  if (state.viewMode === "line") {
    setOverrideField(state.plotSettings, originalTitleFor(file), "xlabel", el.xlabelInput.value);
  } else {
    currentSettings().xlabel = el.xlabelInput.value;
  }
  renderPlot();
});

el.setYlabelBtn.addEventListener("click", () => {
  const file = currentFile();
  if (!file) return;
  if (state.viewMode === "line") {
    setOverrideField(state.plotSettings, originalTitleFor(file), "ylabel", el.ylabelInput.value);
  } else {
    currentSettings().ylabel = el.ylabelInput.value;
  }
  renderPlot();
});

/* ---- config save / load (through the extension host) ------------------- */

el.saveConfigBtn.addEventListener("click", () => {
  post({ type: "saveConfig", raw: serializeConfig(configView) });
});

/* =========================================================================
   RENDERING
   ========================================================================= */

function setStatus(text: string): void {
  el.statusBar.textContent = text;
  post({ type: "status", text });
}

function visibleIndexed(file: LoadedFile): IndexedDataset[] {
  return file.datasets
    .map((d, i) => ({ dataset: d, index: i }))
    .filter((item) => isVisible(state.visibility, item.dataset.name));
}

function renderPlot(): void {
  const file = currentFile();
  el.emptyHint.hidden = !!file;
  if (!file) {
    purge(el.plotDiv);
    setStatus("No file selected.");
    return;
  }

  const settings = currentSettings();
  el.binsInput.value = String(settings.bins || 20);
  el.legendToggle.checked = settings.showLegend !== false;

  const originalTitle = originalTitleFor(file);
  // Naming-rule-derived defaults only apply in line mode, where labels are
  // already per-title; histogram's label is a single field shared by every
  // loaded file, so a per-file naming rule has nothing sensible to attach to.
  const naming =
    state.viewMode === "line"
      ? resolveNamingLabels(state.namingRules, originalTitle)
      : {};
  const displayTitle = resolveDisplayTitle(settings, originalTitle, naming.title);

  el.titleInput.value = displayTitle;
  if (state.viewMode === "line") {
    el.xlabelInput.value = getFieldOr(
      settings,
      originalTitle,
      "xlabel",
      naming.xlabel ?? settings.xlabel,
    ) as string;
    el.ylabelInput.value = getFieldOr(
      settings,
      originalTitle,
      "ylabel",
      naming.ylabel ?? settings.ylabel,
    ) as string;
  } else {
    el.xlabelInput.value = settings.xlabel ?? "";
    el.ylabelInput.value = settings.ylabel ?? "";
  }

  renderDatasetList();

  const theme = readTheme();
  const visible = visibleIndexed(file);

  if (state.viewMode === "histogram") {
    renderHistogram(el.plotDiv, displayTitle, {
      visible,
      colors: state.colors,
      bins: state.histSettings.bins ?? 20,
      xlabel: el.xlabelInput.value,
      ylabel: el.ylabelInput.value,
      showLegend: state.histSettings.showLegend !== false,
      theme,
    });
  } else {
    renderLine(el.plotDiv, displayTitle, {
      visible,
      colors: state.colors,
      xlabel: el.xlabelInput.value,
      ylabel: el.ylabelInput.value,
      showLegend: state.plotSettings.showLegend !== false,
      theme,
    });
  }

  const modeLabel = { line: "line plot", histogram: "histogram" }[state.viewMode];
  setStatus(`${file.name} — ${file.datasets.length} dataset(s) — ${modeLabel} view`);
}

/* =========================================================================
   HOST <-> WEBVIEW MESSAGING
   ========================================================================= */

function persistUiState(): void {
  const file = currentFile();
  const uiState: UiState = {
    viewMode: state.viewMode,
    panelOpen: inspectorOpen,
    selectedFile: file ? file.name : undefined,
  };
  post({ type: "persistUiState", uiState });
}

function loadFiles(
  files: { name: string; text: string }[],
  primary: string | undefined,
  settingsPalette: string[],
  defView: ViewMode | "auto",
  defBins: number,
  namingRules: NamingRule[],
  uiState: UiState,
  config: unknown,
): void {
  state.files = files.map((f) => ({ name: f.name, datasets: parseDataFile(f.name, f.text) }));
  state.currentIndex = -1;
  state.colors = makeColorConfig(settingsPalette);
  state.histSettings.bins = defBins || 20;
  state.namingRules = namingRules;
  defaultView = defView;

  if (config) deserializeConfig(config as Record<string, unknown>, configView);

  setInspectorOpen(!!uiState.panelOpen);

  if (!state.files.length) {
    renderPlot();
    return;
  }

  // Pick the file to show: persisted selection, else the primary, else the first.
  let idx = 0;
  const wanted = uiState.selectedFile ?? primary;
  if (wanted) {
    const found = state.files.findIndex((f) => f.name === wanted);
    if (found >= 0) idx = found;
  }

  if (uiState.viewMode) {
    state.viewMode = uiState.viewMode;
    selectFile(idx, true);
  } else {
    selectFile(idx);
  }
}

window.addEventListener("message", (event: MessageEvent<HostToWebview>) => {
  const msg = event.data;
  switch (msg.type) {
    case "loadFiles":
      loadFiles(
        msg.files,
        msg.primary,
        msg.settings.palette,
        msg.settings.defaultView,
        msg.settings.defaultBins,
        msg.settings.namingRules,
        msg.uiState,
        msg.config,
      );
      break;
    case "setViewMode":
      state.viewMode = msg.mode;
      syncViewButtons();
      renderPlot();
      persistUiState();
      break;
    case "requestSaveConfig":
      post({ type: "saveConfig", raw: serializeConfig(configView) });
      break;
    case "setNamingRules":
      state.namingRules = msg.namingRules;
      renderPlot();
      break;
  }
});

/* Re-theme the plot when VS Code's color theme changes (it toggles a class on
   <body>). */
new MutationObserver(() => {
  if (currentFile()) renderPlot();
}).observe(document.body, { attributes: true, attributeFilter: ["class"] });

/* Initial state */
setStatus("No file selected.");
post({ type: "ready" });
