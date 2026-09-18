/**
 * Activity Bar tree view ("Data Files") listing every `.xy` / `.y` file in the
 * workspace, replacing the always-visible file list that used to live inside
 * the webview's inspector drawer. Clicking an item opens it via the existing
 * `xyPlot.open` command — one file per editor tab, VS Code's own tab bar is
 * how you switch between them, same as any other file type.
 */
import * as vscode from "vscode";
import * as path from "path";

const GLOB = "**/*.{xy,y,XY,Y}";
const EXCLUDE = "**/node_modules/**";

export class DataFilesProvider implements vscode.TreeDataProvider<vscode.Uri>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;
  private readonly watcher: vscode.FileSystemWatcher;

  constructor() {
    this.watcher = vscode.workspace.createFileSystemWatcher(GLOB);
    this.watcher.onDidCreate(() => this.refresh());
    this.watcher.onDidDelete(() => this.refresh());
    this.watcher.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this.emitter.fire();
  }

  dispose(): void {
    this.watcher.dispose();
  }

  async getChildren(): Promise<vscode.Uri[]> {
    if (!vscode.workspace.workspaceFolders?.length) return [];
    const uris = await vscode.workspace.findFiles(GLOB, EXCLUDE);
    return uris.sort((a, b) =>
      vscode.workspace.asRelativePath(a).localeCompare(vscode.workspace.asRelativePath(b)),
    );
  }

  getTreeItem(uri: vscode.Uri): vscode.TreeItem {
    const item = new vscode.TreeItem(path.basename(uri.fsPath));
    item.resourceUri = uri;
    const relDir = vscode.workspace.asRelativePath(path.dirname(uri.fsPath));
    item.description = relDir === "." ? undefined : relDir;
    item.tooltip = vscode.workspace.asRelativePath(uri);
    item.iconPath = vscode.ThemeIcon.File;
    item.contextValue = "xyPlotDataFile";
    item.command = { command: "xyPlot.open", title: "Open in XY Plot Viewer", arguments: [uri] };
    return item;
  }
}
