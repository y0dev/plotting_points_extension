import { describe, it, expect } from "vitest";
import { matchesPattern, resolveNamingLabels, type NamingRule } from "../src/core/namingRules";

describe("matchesPattern", () => {
  it("matches literally with no wildcard", () => {
    expect(matchesPattern("match_scan_001", "match_scan_001")).toBe(true);
    expect(matchesPattern("match_scan_001", "match_scan_002")).toBe(false);
  });

  it("supports a trailing wildcard", () => {
    expect(matchesPattern("match_scan_*", "match_scan_001")).toBe(true);
    expect(matchesPattern("match_scan_*", "calibration_002")).toBe(false);
  });

  it("supports a leading wildcard", () => {
    expect(matchesPattern("*_noise", "sensor_noise")).toBe(true);
    expect(matchesPattern("*_noise", "sensor_noise_2")).toBe(false);
  });

  it("supports a wildcard in the middle", () => {
    expect(matchesPattern("calib*002", "calibration_002")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesPattern("MATCH_scan_*", "match_SCAN_001")).toBe(true);
  });

  it("escapes regex metacharacters in the literal part", () => {
    expect(matchesPattern("run.1", "run.1")).toBe(true);
    expect(matchesPattern("run.1", "runX1")).toBe(false);
  });
});

describe("resolveNamingLabels", () => {
  it("returns {} when nothing matches", () => {
    expect(resolveNamingLabels([{ match: "nope_*" }], "match_scan_001")).toEqual({});
  });

  it("applies a single matching rule's fields", () => {
    const rules: NamingRule[] = [
      { match: "match_scan_*", xlabel: "Scan Position", ylabel: "Signal Amplitude" },
    ];
    expect(resolveNamingLabels(rules, "match_scan_001")).toEqual({
      xlabel: "Scan Position",
      ylabel: "Signal Amplitude",
    });
  });

  it("merges multiple matching rules, later rule winning per-field", () => {
    const rules: NamingRule[] = [
      { match: "*", xlabel: "Value" },
      { match: "match_scan_*", ylabel: "Signal Amplitude" },
      { match: "match_scan_001", xlabel: "Scan Position" },
    ];
    expect(resolveNamingLabels(rules, "match_scan_001")).toEqual({
      xlabel: "Scan Position",
      ylabel: "Signal Amplitude",
    });
  });

  it("ignores null/undefined rule fields rather than blanking prior matches", () => {
    const rules: NamingRule[] = [
      { match: "*", title: "Default Title" },
      { match: "match_scan_*", xlabel: "Scan Position" },
    ];
    expect(resolveNamingLabels(rules, "match_scan_001")).toEqual({
      title: "Default Title",
      xlabel: "Scan Position",
    });
  });
});
