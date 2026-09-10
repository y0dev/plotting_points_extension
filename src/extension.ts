import * as vscode from "vscode";
import { XyPlotEditorProvider } from "./editor/xyPlotEditorProvider";
import { openCommand } from "./commands/open";
import { openFolderCommand } from "./commands/openFolder";
import { saveConfigCommand, loadConfigCommand } from "./commands/config";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    XyPlotEditorProvider.register(context),
    vscode.commands.registerCommand("xyPlot.open", openCommand),
    vscode.commands.registerCommand("xyPlot.openFolder", openFolderCommand),
    vscode.commands.registerCommand("xyPlot.saveConfig", saveConfigCommand),
    vscode.commands.registerCommand("xyPlot.loadConfig", loadConfigCommand),
  );
}

export function deactivate(): void {
  /* nothing to clean up */
}
