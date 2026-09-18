/**
 * Typed message protocol between the extension host and the webview. Both ends
 * import this module; it must stay free of `vscode` and DOM references.
 */
import type { NamingRule } from "./core/namingRules";

export type ViewMode = "line" | "histogram";
export type DefaultView = "auto" | ViewMode;

/** Raw text of one data file, as read by the extension host. */
export interface RawFile {
  name: string;
  text: string;
}

/** Settings sourced from `contributes.configuration`, forwarded to the webview. */
export interface HostSettings {
  defaultBins: number;
  defaultView: DefaultView;
  palette: string[];
  autoLoadConfig: boolean;
  /** `xyPlot.namingRules`, merged across the User and Workspace setting scopes. */
  namingRules: NamingRule[];
}

/** Per-resource UI state, persisted in `workspaceState` keyed by the URI. */
export interface UiState {
  viewMode?: ViewMode;
  panelOpen?: boolean;
  selectedFile?: string;
}

/* ---- host → webview ---------------------------------------------------- */

export interface LoadFilesMsg {
  type: "loadFiles";
  files: RawFile[];
  /** Name of the file to select first; defaults to `files[0]`. */
  primary?: string;
  settings: HostSettings;
  uiState: UiState;
  /** Parsed `xy_plot_config.json` found next to the data, if auto-load applies. */
  config?: unknown;
}

export interface SetViewModeMsg {
  type: "setViewMode";
  mode: ViewMode;
}

export interface RequestSaveConfigMsg {
  type: "requestSaveConfig";
}

/** Live update when `xyPlot.namingRules` changes while a viewer is already open. */
export interface SetNamingRulesMsg {
  type: "setNamingRules";
  namingRules: NamingRule[];
}

export type HostToWebview =
  | LoadFilesMsg
  | SetViewModeMsg
  | RequestSaveConfigMsg
  | SetNamingRulesMsg;

/* ---- webview → host -------------------------------------------------- */

export interface ReadyMsg {
  type: "ready";
}

export interface SaveConfigMsg {
  type: "saveConfig";
  raw: unknown;
}

export interface PersistUiStateMsg {
  type: "persistUiState";
  uiState: UiState;
}

export interface StatusMsg {
  type: "status";
  text: string;
}

export type WebviewToHost =
  | ReadyMsg
  | SaveConfigMsg
  | PersistUiStateMsg
  | StatusMsg;
