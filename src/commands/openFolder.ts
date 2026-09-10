import * as vscode from "vscode";

const DATA_RE = /\.(xy|y)$/i;
const VIEW_TYPE = "xyPlot.viewer";

/**
 * `xyPlot.openFolder` — pick a folder (or use the one from the explorer context
 * menu), then open its `.xy` / `.y` files (sorted by name) in the viewer. The
 * custom editor's sibling-folder scan loads the rest of the list once the first
 * file is open.
 */
export async function openFolderCommand(folder?: vscode.Uri): Promise<void> {
  let target = folder;
  if (!target) {
    const picked = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: "Open Folder in XY Plot Viewer",
    });
    if (!picked || !picked.length) return;
    target = picked[0];
  }

  let names: string[] = [];
  try {
    const entries = await vscode.workspace.fs.readDirectory(target);
    names = entries
      .filter(([n, type]) => type === vscode.FileType.File && DATA_RE.test(n))
      .map(([n]) => n)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    void vscode.window.showErrorMessage(`Could not read folder ${target.fsPath}.`);
    return;
  }

  if (!names.length) {
    void vscode.window.showWarningMessage(
      `No .xy or .y files found in ${vscode.workspace.asRelativePath(target)}.`,
    );
    return;
  }

  await vscode.commands.executeCommand(
    "vscode.openWith",
    vscode.Uri.joinPath(target, names[0]),
    VIEW_TYPE,
  );
}
