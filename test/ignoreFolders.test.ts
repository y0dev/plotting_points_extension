import { describe, it, expect } from "vitest";
import { isIgnoredPath } from "../src/core/ignoreFolders";

describe("isIgnoredPath", () => {
  it("returns false with no ignore terms", () => {
    expect(isIgnoredPath("data/archive/run.xy", [])).toBe(false);
  });

  it("matches an exact directory name", () => {
    expect(isIgnoredPath("data/archive/run.xy", ["archive"])).toBe(true);
    expect(isIgnoredPath("data/current/run.xy", ["archive"])).toBe(false);
  });

  it("matches a directory name that only contains the term", () => {
    expect(isIgnoredPath("data/old_archive_2024/run.xy", ["archive"])).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isIgnoredPath("data/Archived/run.xy", ["archive"])).toBe(true);
  });

  it("never matches the file name itself, only directory segments", () => {
    expect(isIgnoredPath("data/current/archive_run.xy", ["archive"])).toBe(false);
  });

  it("checks every directory segment, not just the immediate parent", () => {
    expect(isIgnoredPath("archive/2024/run.xy", ["archive"])).toBe(true);
  });

  it("ignores blank / whitespace-only terms", () => {
    expect(isIgnoredPath("data/archive/run.xy", ["", "   "])).toBe(false);
  });

  it("matches if any of several terms hits", () => {
    expect(isIgnoredPath("data/scratch/run.xy", ["archive", "scratch"])).toBe(true);
  });
});
