import * as vscode from "vscode";

const DATA_RE = /\.(xy|y)$/i;
const VIEW_TYPE = "xyPlot.viewer";

/**
 * `xyPlot.openFolder` — pick a folder (or use the one from the explorer context
 * menu), then open its `.xy` / `.y` files (sorted by name) in the viewer.
 *
 * If the picked folder is already inside the current workspace (always true
 * for the explorer context-menu path), it opens in place — the custom
 * editor's sibling-folder scan loads the rest of the list once the first file
 * is open.
 *
 * If it's **outside** the workspace (an instrument's output folder,
 * Downloads, …), the matching files are first copied — never moved, the
 * originals are left untouched — into `xyPlot.importFolder` under the first
 * workspace folder, and it's those copies that get opened. The data ends up
 * living in the project instead of wherever it started.
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

  let openDir = target;
  if (!vscode.workspace.getWorkspaceFolder(target)) {
    openDir = (await importIntoWorkspace(target, names)) ?? target;
  }

  await vscode.commands.executeCommand(
    "vscode.openWith",
    vscode.Uri.joinPath(openDir, names[0]),
    VIEW_TYPE,
  );
}

/**
 * Copy `names` from `source` into `xyPlot.importFolder` (default `"data"`)
 * under the first workspace folder, skipping any file that's already there
 * rather than overwriting it. Returns the destination directory, or
 * `undefined` if there is no open workspace to import into — the caller then
 * falls back to opening `source` in place.
 */
async function importIntoWorkspace(
  source: vscode.Uri,
  names: string[],
): Promise<vscode.Uri | undefined> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    void vscode.window.showWarningMessage(
      "No workspace is open, so the data can't be imported into a project — opening it in place instead.",
    );
    return undefined;
  }

  const importFolder =
    vscode.workspace.getConfiguration("xyPlot").get<string>("importFolder", "data") || "data";
  const destDir = vscode.Uri.joinPath(workspaceFolder.uri, importFolder);

  try {
    await vscode.workspace.fs.createDirectory(destDir);
  } catch {
    /* already exists */
  }

  let copied = 0;
  let skipped = 0;
  for (const name of names) {
    try {
      // overwrite:false throws if the destination already exists — treated
      // as "already imported", not an error worth surfacing.
      await vscode.workspace.fs.copy(vscode.Uri.joinPath(source, name), vscode.Uri.joinPath(destDir, name), {
        overwrite: false,
      });
      copied++;
    } catch {
      skipped++;
    }
  }

  if (copied) {
    const rel = vscode.workspace.asRelativePath(destDir);
    void vscode.window.showInformationMessage(
      `Imported ${copied} file(s) into ${rel}/` + (skipped ? ` (${skipped} already there, left as-is).` : "."),
    );
  }

  return destDir;
}
