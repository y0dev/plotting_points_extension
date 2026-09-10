import { describe, it, expect } from "vitest";
import {
  makeTitleSettings,
  getDisplayTitle,
  getFieldOr,
  setOverrideField,
} from "../src/core/titleSettings";

describe("title / label overrides", () => {
  it("getDisplayTitle falls back to the original title", () => {
    const s = makeTitleSettings();
    expect(getDisplayTitle(s, "scan_001")).toBe("scan_001");
    setOverrideField(s, "scan_001", "displayTitle", "Scan 001");
    expect(getDisplayTitle(s, "scan_001")).toBe("Scan 001");
  });

  it("getFieldOr follows override -> fallback", () => {
    const s = makeTitleSettings({ xlabel: "Run" });
    expect(getFieldOr(s, "t", "xlabel", s.xlabel)).toBe("Run");
    setOverrideField(s, "t", "xlabel", "Scan Position");
    expect(getFieldOr(s, "t", "xlabel", s.xlabel)).toBe("Scan Position");
    // a different title still gets the global fallback
    expect(getFieldOr(s, "other", "xlabel", s.xlabel)).toBe("Run");
  });

  it("empty-string overrides do not win (falsy check, matching the source)", () => {
    const s = makeTitleSettings({ ylabel: "Value" });
    setOverrideField(s, "t", "ylabel", "");
    expect(getFieldOr(s, "t", "ylabel", s.ylabel)).toBe("Value");
  });

  it("line mode keeps X/Y labels per title; histogram uses the global field", () => {
    // Line mode: per-title override on plotSettings.
    const line = makeTitleSettings({ xlabel: "Run", ylabel: "Value" });
    setOverrideField(line, "a", "xlabel", "A-only X");
    expect(getFieldOr(line, "a", "xlabel", line.xlabel)).toBe("A-only X");
    expect(getFieldOr(line, "b", "xlabel", line.xlabel)).toBe("Run");

    // Histogram mode: the label is the settings-global field, shared by all titles.
    const hist = makeTitleSettings({ xlabel: "Value", ylabel: "Count" });
    hist.xlabel = "Measured Value";
    expect(hist.xlabel).toBe("Measured Value");
  });

  it("setOverrideField creates the nested override object on demand", () => {
    const s = makeTitleSettings();
    expect(s.overrides["t"]).toBeUndefined();
    setOverrideField(s, "t", "displayTitle", "T");
    expect(s.overrides["t"]).toEqual({ displayTitle: "T" });
  });
});
