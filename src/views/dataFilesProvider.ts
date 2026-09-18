/**
 * Activity Bar tree view ("Data Files") for every `.xy` / `.y` file in the
 * workspace. Files are grouped by their containing folder — a file sitting
 * directly at a workspace root is a plain leaf; anything inside a subfolder
 * is grouped under a node labeled by that subfolder's relative path — so two
 * files sharing a name in different folders (`data/run1/scan.xy` vs.
 * `data/run2/scan.xy`) read unambiguously instead of as two identical rows in
 * one flat list. Clicking a file opens it via `xyPlot.open`; switching
 * between open files is VS Code's own tab bar, not this view.
 *
 * `xyPlot.ignoreFolders` additionally drops any file under a directory whose
 * name *contains* one of the configured terms (see `core/ignoreFolders.ts`),
 * on top of `node_modules` / `.git`, which are always skipped.
 */
import * as vscode from "vscode";
import * as path from "path";
import { isIgnoredPath } from "../core/ignoreFolders";

const GLOB = "**/*.{xy,y,XY,Y}";
const ALWAYS_EXCLUDE = "**/{node_modules,.git}/**";

export interface FolderNode {
  kind: "folder";
  /** Relative path of the folder, e.g. "data/run1" — also its display label. */
  relPath: string;
}
export interface FileNode {
  kind: "file";
  uri: vscode.Uri;
}
export type DataFileNode = FolderNode | FileNode;

export class DataFilesProvider implements vscode.TreeDataProvider<DataFileNode>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;
  private readonly watcher: vscode.FileSystemWatcher;
  private readonly configSub: vscode.Disposable;

  constructor() {
    this.watcher = vscode.workspace.createFileSystemWatcher(GLOB);
    this.watcher.onDidCreate(() => this.refresh());
    this.watcher.onDidDelete(() => this.refresh());
    this.watcher.onDidChange(() => this.refresh());

    // xyPlot.ignoreFolders applies immediately, same as xyPlot.namingRules.
    this.configSub = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("xyPlot.ignoreFolders")) this.refresh();
    });
  }

  refresh(): void {
    this.emitter.fire();
  }

  dispose(): void {
    this.watcher.dispose();
    this.configSub.dispose();
  }

  async getChildren(node?: DataFileNode): Promise<DataFileNode[]> {
    if (!vscode.workspace.workspaceFolders?.length) return [];
    const { rootFiles, folders } = await this.scan();

    if (!node) {
      const folderNodes: FolderNode[] = [...folders.keys()]
        .sort((a, b) => a.localeCompare(b))
        .map((relPath) => ({ kind: "folder", relPath }));
      const fileNodes: FileNode[] = sortByBasename(rootFiles).map((uri) => ({ kind: "file", uri }));
      return [...folderNodes, ...fileNodes];
    }

    if (node.kind === "folder") {
      return sortByBasename(folders.get(node.relPath) ?? []).map((uri) => ({ kind: "file", uri }));
    }

    return [];
  }

  getTreeItem(node: DataFileNode): vscode.TreeItem {
    if (node.kind === "folder") {
      const item = new vscode.TreeItem(node.relPath, vscode.TreeItemCollapsibleState.Collapsed);
      item.id = `folder:${node.relPath}`;
      item.iconPath = vscode.ThemeIcon.Folder;
      item.contextValue = "xyPlotFolder";
      return item;
    }

    const item = new vscode.TreeItem(path.basename(node.uri.fsPath));
    item.id = `file:${vscode.workspace.asRelativePath(node.uri)}`;
    item.resourceUri = node.uri;
    item.tooltip = vscode.workspace.asRelativePath(node.uri);
    item.iconPath = vscode.ThemeIcon.File;
    item.contextValue = "xyPlotDataFile";
    item.command = { command: "xyPlot.open", title: "Open in XY Plot Viewer", arguments: [node.uri] };
    return item;
  }

  /** Every `.xy` / `.y` file, minus ignored ones, split into root files and folder groups. */
  private async scan(): Promise<{ rootFiles: vscode.Uri[]; folders: Map<string, vscode.Uri[]> }> {
    const ignoreTerms = vscode.workspace.getConfiguration("xyPlot").get<string[]>("ignoreFolders", []);
    const uris = await vscode.workspace.findFiles(GLOB, ALWAYS_EXCLUDE);

    const rootFiles: vscode.Uri[] = [];
    const folders = new Map<string, vscode.Uri[]>();

    for (const uri of uris) {
      const rel = vscode.workspace.asRelativePath(uri);
      if (isIgnoredPath(rel, ignoreTerms)) continue;

      const relDir = vscode.workspace.asRelativePath(path.dirname(uri.fsPath));
      if (relDir === ".") {
        rootFiles.push(uri);
      } else {
        const bucket = folders.get(relDir);
        if (bucket) bucket.push(uri);
        else folders.set(relDir, [uri]);
      }
    }
    return { rootFiles, folders };
  }
}

function sortByBasename(uris: vscode.Uri[]): vscode.Uri[] {
  return [...uris].sort((a, b) => path.basename(a.fsPath).localeCompare(path.basename(b.fsPath)));
}
