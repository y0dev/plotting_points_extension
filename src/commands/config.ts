import * as vscode from "vscode";
import { XyPlotEditorProvider } from "../editor/xyPlotEditorProvider";

const NO_VIEWER =
  "Open a .xy / .y file in the XY Plot Viewer first, then run this command.";

/** `xyPlot.saveConfig` — write the focused viewer's current config to a JSON file. */
export async function saveConfigCommand(): Promise<void> {
  if (!XyPlotEditorProvider.requestSaveConfig()) {
    void vscode.window.showWarningMessage(NO_VIEWER);
  }
}

/** `xyPlot.loadConfig` — pick a JSON config and apply it to the focused viewer. */
export async function loadConfigCommand(): Promise<void> {
  if (!(await XyPlotEditorProvider.loadConfigInteractive())) {
    void vscode.window.showWarningMessage(NO_VIEWER);
  }
}
