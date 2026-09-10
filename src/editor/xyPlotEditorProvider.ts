/**
 * Custom editor for `.xy` / `.y` files. Opening one file shows it plotted; the
 * containing folder is scanned for the rest so you can switch between them. The
 * webview bundles Plotly locally and loads no remote assets (CSP + nonce,
 * `localResourceRoots` limited to `media/`).
 *
 * The extension never writes `.xy` / `.y` files — this is a read-only editor
 * with respect to the data. Config, however, round-trips to a workspace JSON
 * file through the Save / Load Config messages handled here.
 */
import * as vscode from "vscode";
import * as path from "path";
import type {
  HostToWebview,
  HostSettings,
  RawFile,
  UiState,
  WebviewToHost,
} from "../protocol";
import { DEFAULT_PALETTE } from "../core/palette";
import { makeNonce, renderTemplate } from "./template";

const VIEW_TYPE = "xyPlot.viewer";
const DATA_RE = /\.(xy|y)$/i;

interface PanelCtx {
  panel: vscode.WebviewPanel;
  document: vscode.TextDocument;
  dir: vscode.Uri | undefined;
}

export class XyPlotEditorProvider implements vscode.CustomTextEditorProvider {
  /** The panel that last had focus — target for the Save / Load Config commands. */
  private static active: PanelCtx | undefined;
  private readonly panels = new Set<PanelCtx>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new XyPlotEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    });
  }

  /** Ask the focused viewer to emit its current config for saving. */
  static requestSaveConfig(): boolean {
    if (!XyPlotEditorProvider.active) return false;
    void XyPlotEditorProvider.active.panel.webview.postMessage({
      type: "requestSaveConfig",
    } satisfies HostToWebview);
    return true;
  }

  /** Show an open dialog and push the chosen config into the focused viewer. */
  static async loadConfigInteractive(): Promise<boolean> {
    const ctx = XyPlotEditorProvider.active;
    if (!ctx) return false;
    await pushConfigFromDialog(ctx);
    return true;
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, "media");
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [mediaRoot],
    };

    const nonce = makeNonce();
    const webview = webviewPanel.webview;
    webviewPanel.webview.html = renderTemplate({
      cspSource: webview.cspSource,
      nonce,
      scriptUri: webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "webview.js")).toString(),
      styleUri: webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "ui.css")).toString(),
      plotlyStyleUri: webview
        .asWebviewUri(vscode.Uri.joinPath(mediaRoot, "webview.css"))
        .toString(),
    });

    const dir =
      document.uri.scheme === "file"
        ? vscode.Uri.file(path.dirname(document.uri.fsPath))
        : undefined;
    const ctx: PanelCtx = { panel: webviewPanel, document, dir };
    this.panels.add(ctx);
    XyPlotEditorProvider.active = ctx;

    const stateKey = uiStateKey(document.uri);

    webview.onDidReceiveMessage(async (msg: WebviewToHost) => {
      switch (msg.type) {
        case "ready":
          await this.sendLoadFiles(ctx, stateKey);
          break;
        case "persistUiState":
          await this.context.workspaceState.update(stateKey, msg.uiState);
          break;
        case "saveConfig":
          await saveConfigToFile(ctx, msg.raw);
          break;
        case "requestConfigLoad":
          await pushConfigFromDialog(ctx);
          break;
        case "status":
          // Reserved for a future status-bar item; nothing to do here.
          break;
      }
    });

    webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active) XyPlotEditorProvider.active = ctx;
    });

    // Re-plot when the opened document changes on disk / in another editor.
    const docSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        void this.sendLoadFiles(ctx, stateKey);
      }
    });

    webviewPanel.onDidDispose(() => {
      docSub.dispose();
      this.panels.delete(ctx);
      if (XyPlotEditorProvider.active === ctx) {
        XyPlotEditorProvider.active = this.panels.values().next().value ?? undefined;
      }
    });
  }

  private async sendLoadFiles(ctx: PanelCtx, stateKey: string): Promise<void> {
    const primaryName = path.basename(ctx.document.uri.fsPath);
    const files = await gatherFiles(ctx.dir, primaryName, ctx.document.getText());
    const settings = readHostSettings();
    const uiState = this.context.workspaceState.get<UiState>(stateKey) ?? {};

    let config: unknown;
    if (settings.autoLoadConfig && ctx.dir) {
      config = await tryReadJson(vscode.Uri.joinPath(ctx.dir, "xy_plot_config.json"));
    }

    const message: HostToWebview = {
      type: "loadFiles",
      files,
      primary: primaryName,
      settings,
      uiState,
      config,
    };
    void ctx.panel.webview.postMessage(message);
  }
}

/* ---- helpers -------------------------------------------------------------- */

function uiStateKey(uri: vscode.Uri): string {
  return `xyPlot.ui:${uri.toString()}`;
}

function readHostSettings(): HostSettings {
  const cfg = vscode.workspace.getConfiguration("xyPlot");
  const palette = cfg.get<string[]>("palette");
  return {
    defaultBins: cfg.get<number>("defaultBins", 20),
    defaultView: cfg.get<HostSettings["defaultView"]>("defaultView", "auto"),
    palette: palette && palette.length ? palette : [...DEFAULT_PALETTE],
    autoLoadConfig: cfg.get<boolean>("autoLoadConfig", false),
  };
}

/**
 * Read every `.xy` / `.y` file in `dir` (sorted by name); substitute the live
 * text of the primary document so unsaved edits are reflected. Falls back to
 * just the primary when there is no folder context.
 */
async function gatherFiles(
  dir: vscode.Uri | undefined,
  primaryName: string,
  primaryText: string,
): Promise<RawFile[]> {
  if (!dir) return [{ name: primaryName, text: primaryText }];

  let names: string[] = [];
  try {
    const entries = await vscode.workspace.fs.readDirectory(dir);
    names = entries
      .filter(([n, type]) => type === vscode.FileType.File && DATA_RE.test(n))
      .map(([n]) => n)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [{ name: primaryName, text: primaryText }];
  }
  if (!names.includes(primaryName)) names.push(primaryName);

  const decoder = new TextDecoder();
  const out: RawFile[] = [];
  for (const name of names) {
    if (name === primaryName) {
      out.push({ name, text: primaryText });
      continue;
    }
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(dir, name));
      out.push({ name, text: decoder.decode(bytes) });
    } catch {
      /* skip unreadable file */
    }
  }
  return out;
}

async function tryReadJson(uri: vscode.Uri): Promise<unknown> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

async function saveConfigToFile(ctx: PanelCtx, raw: unknown): Promise<void> {
  const wsFolder = ctx.dir
    ? vscode.workspace.getWorkspaceFolder(ctx.dir)
    : vscode.workspace.workspaceFolders?.[0];
  const defaultDir = wsFolder
    ? vscode.Uri.joinPath(wsFolder.uri, ".vscode", "xy-plot")
    : ctx.dir ?? vscode.Uri.file(process.cwd());

  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.joinPath(defaultDir, "xy_plot_config.json"),
    filters: { JSON: ["json"] },
    saveLabel: "Save XY Plot Config",
  });
  if (!target) return;

  const dir = vscode.Uri.file(path.dirname(target.fsPath));
  try {
    await vscode.workspace.fs.createDirectory(dir);
  } catch {
    /* already exists */
  }
  const body = JSON.stringify(raw, null, 2);
  await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(body));
  void vscode.window.showInformationMessage(
    `Saved config to ${vscode.workspace.asRelativePath(target)}.`,
  );
}

async function pushConfigFromDialog(ctx: PanelCtx): Promise<void> {
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { JSON: ["json"] },
    defaultUri: ctx.dir,
    openLabel: "Load XY Plot Config",
  });
  if (!picked || !picked.length) return;

  const parsed = await tryReadJson(picked[0]);
  if (parsed === undefined) {
    void vscode.window.showErrorMessage(
      `Could not read ${path.basename(picked[0].fsPath)} as JSON.`,
    );
    return;
  }
  void ctx.panel.webview.postMessage({
    type: "loadConfig",
    raw: parsed,
    source: path.basename(picked[0].fsPath),
  } satisfies HostToWebview);
}
