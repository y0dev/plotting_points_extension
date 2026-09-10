import { describe, it, expect } from "vitest";
import { makeColorConfig, setColor } from "../src/core/colorConfig";
import { makeTitleSettings, setOverrideField } from "../src/core/titleSettings";
import { makeVisibility, setVisible } from "../src/core/visibility";
import {
  serializeConfig,
  deserializeConfig,
  type PlotState,
} from "../src/core/config";

function freshState(): PlotState {
  return {
    colors: makeColorConfig(),
    plotSettings: makeTitleSettings({ xlabel: "Run", ylabel: "Value", showLegend: true }),
    histSettings: makeTitleSettings({ bins: 20, xlabel: "Value", ylabel: "Count", showLegend: true }),
    visibility: makeVisibility(),
  };
}

describe("config round-trip", () => {
  it("save -> JSON -> load reproduces the state", () => {
    const a = freshState();
    setColor(a.colors, "Match_RunA", "#2ca02c");
    setOverrideField(a.plotSettings, "match_scan_001", "displayTitle", "Match Scan 001");
    setOverrideField(a.plotSettings, "match_scan_001", "xlabel", "Scan Position");
    a.histSettings.bins = 25;
    a.histSettings.xlabel = "Measured Value";
    setVisible(a.visibility, "Noisy", false);

    const json = JSON.parse(JSON.stringify(serializeConfig(a)));
    const b = freshState();
    deserializeConfig(json, b);

    expect(b.colors.datasetColors).toEqual({ "Match_RunA": "#2ca02c" });
    expect(b.plotSettings.overrides["match_scan_001"]).toEqual({
      displayTitle: "Match Scan 001",
      xlabel: "Scan Position",
    });
    expect(b.histSettings.bins).toBe(25);
    expect(b.histSettings.xlabel).toBe("Measured Value");
    expect(Array.from(b.visibility.hiddenNames)).toEqual(["Noisy"]);
  });

  it("missing keys fall back to the source-app defaults", () => {
    const s = freshState();
    deserializeConfig({}, s);
    expect(s.colors.palette.length).toBe(10);
    expect(s.plotSettings).toMatchObject({ xlabel: "Run", ylabel: "Value", showLegend: true });
    expect(s.histSettings).toMatchObject({ bins: 20, xlabel: "Value", ylabel: "Count" });
    expect(Array.from(s.visibility.hiddenNames)).toEqual([]);
  });

  it("treats showLegend as `!== false`", () => {
    const off = freshState();
    deserializeConfig({ plot_settings: { showLegend: false } }, off);
    expect(off.plotSettings.showLegend).toBe(false);

    const present = freshState();
    deserializeConfig({ plot_settings: { xlabel: "x" } }, present);
    expect(present.plotSettings.showLegend).toBe(true);

    const absent = freshState();
    deserializeConfig({}, absent);
    expect(absent.plotSettings.showLegend).toBe(true);

    const histOff = freshState();
    deserializeConfig({ histogram_settings: { showLegend: false } }, histOff);
    expect(histOff.histSettings.showLegend).toBe(false);
  });
});
