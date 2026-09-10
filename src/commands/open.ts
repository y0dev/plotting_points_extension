import * as vscode from "vscode";

const DATA_RE = /\.(xy|y)$/i;
const VIEW_TYPE = "xyPlot.viewer";

/**
 * `xyPlot.open` — open the focused / selected `.xy` / `.y` file(s) in the XY
 * Plot Viewer. Invoked from the explorer context menu (`uri`, `uris`) or against
 * the active editor.
 */
export async function openCommand(uri?: vscode.Uri, uris?: vscode.Uri[]): Promise<void> {
  let targets: vscode.Uri[] = [];
  if (uris && uris.length) targets = uris;
  else if (uri) targets = [uri];
  else if (vscode.window.activeTextEditor) targets = [vscode.window.activeTextEditor.document.uri];

  targets = targets.filter((u) => DATA_RE.test(u.path));
  if (!targets.length) {
    void vscode.window.showWarningMessage("Select a .xy or .y file to open in the XY Plot Viewer.");
    return;
  }

  for (const target of targets) {
    await vscode.commands.executeCommand("vscode.openWith", target, VIEW_TYPE);
  }
}
