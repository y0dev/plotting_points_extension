import { describe, it, expect } from "vitest";
import {
  makeColorConfig,
  getColor,
  setColor,
  clearAllColors,
} from "../src/core/colorConfig";
import { DEFAULT_PALETTE } from "../src/core/palette";

describe("color config", () => {
  it("cycles the palette by dataset index", () => {
    const cfg = makeColorConfig();
    expect(getColor(cfg, "a", 0)).toBe(DEFAULT_PALETTE[0]);
    expect(getColor(cfg, "b", 1)).toBe(DEFAULT_PALETTE[1]);
    expect(getColor(cfg, "k", DEFAULT_PALETTE.length)).toBe(DEFAULT_PALETTE[0]);
    expect(getColor(cfg, "l", DEFAULT_PALETTE.length + 3)).toBe(DEFAULT_PALETTE[3]);
  });

  it("lets a per-name override win over the palette", () => {
    const cfg = makeColorConfig();
    setColor(cfg, "series", "#123456");
    expect(getColor(cfg, "series", 0)).toBe("#123456");
    expect(getColor(cfg, "series", 5)).toBe("#123456");
  });

  it("falls back to the default palette when the configured one is empty", () => {
    const cfg = makeColorConfig([]);
    expect(getColor(cfg, "x", 2)).toBe(DEFAULT_PALETTE[2]);
  });

  it("clearAllColors drops every override", () => {
    const cfg = makeColorConfig();
    setColor(cfg, "a", "#aaaaaa");
    setColor(cfg, "b", "#bbbbbb");
    clearAllColors(cfg);
    expect(getColor(cfg, "a", 0)).toBe(DEFAULT_PALETTE[0]);
    expect(getColor(cfg, "b", 1)).toBe(DEFAULT_PALETTE[1]);
  });

  it("makeColorConfig copies the palette (no shared reference)", () => {
    const src = ["#000000"];
    const cfg = makeColorConfig(src);
    src.push("#ffffff");
    expect(cfg.palette).toEqual(["#000000"]);
  });
});
