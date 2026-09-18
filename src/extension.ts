import * as vscode from "vscode";
import { XyPlotEditorProvider } from "./editor/xyPlotEditorProvider";
import { openCommand } from "./commands/open";
import { openFolderCommand } from "./commands/openFolder";
import { saveConfigCommand } from "./commands/config";
import { DataFilesProvider } from "./views/dataFilesProvider";

export function activate(context: vscode.ExtensionContext): void {
  const filesProvider = new DataFilesProvider();

  context.subscriptions.push(
    XyPlotEditorProvider.register(context),
    vscode.window.registerTreeDataProvider("xyPlot.filesView", filesProvider),
    filesProvider,
    vscode.commands.registerCommand("xyPlot.open", openCommand),
    vscode.commands.registerCommand("xyPlot.openFolder", openFolderCommand),
    vscode.commands.registerCommand("xyPlot.saveConfig", saveConfigCommand),
    vscode.commands.registerCommand("xyPlot.refreshFilesView", () => filesProvider.refresh()),
  );
}

export function deactivate(): void {
  /* nothing to clean up */
}
