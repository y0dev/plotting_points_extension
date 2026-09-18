import * as vscode from "vscode";
import { XyPlotEditorProvider } from "../editor/xyPlotEditorProvider";

/** `xyPlot.saveConfig` — write the focused viewer's current config to a JSON file. */
export async function saveConfigCommand(): Promise<void> {
  if (!XyPlotEditorProvider.requestSaveConfig()) {
    void vscode.window.showWarningMessage(
      "Open a .xy / .y file in the XY Plot Viewer first, then run this command.",
    );
  }
}
