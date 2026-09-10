import { describe, it, expect } from "vitest";
import { parseXY, parseY, parseDataFile } from "../src/core/parse";

describe("parseXY", () => {
  it("reads multiple named datasets from one file", () => {
    const text = ["A", "1 10", "2 20", "B", "1 1.5", "2 2.5", "3 3.5"].join("\n");
    const ds = parseXY(text);
    expect(ds).toHaveLength(2);
    expect(ds[0]).toEqual({ name: "A", x: [1, 2], y: [10, 20] });
    expect(ds[1]).toEqual({ name: "B", x: [1, 2, 3], y: [1.5, 2.5, 3.5] });
  });

  it("treats a lone token as a new dataset name with empty x/y", () => {
    const ds = parseXY("Empty\nAlso");
    expect(ds).toEqual([
      { name: "Empty", x: [], y: [] },
      { name: "Also", x: [], y: [] },
    ]);
  });

  it("parses x with parseInt(base 10) and y with parseFloat", () => {
    const ds = parseXY("S\n007 3.14\n10px 9");
    // "007" -> 7 ; "10px" -> 10 (parseInt tolerates trailing junk)
    expect(ds[0].x).toEqual([7, 10]);
    expect(ds[0].y).toEqual([3.14, 9]);
  });

  it("drops a pair when either token is NaN", () => {
    const ds = parseXY("S\nfoo 1\n2 bar\n3 3");
    expect(ds[0]).toEqual({ name: "S", x: [3], y: [3] });
  });

  it("ignores lines with 0 or 3+ tokens", () => {
    const ds = parseXY("S\n1 2 3\n4 5 6 7\n8 9");
    expect(ds[0]).toEqual({ name: "S", x: [8], y: [9] });
  });

  it("ignores value pairs that appear before any dataset name", () => {
    const ds = parseXY("1 2\n3 4\nName\n5 6");
    expect(ds).toEqual([{ name: "Name", x: [5], y: [6] }]);
  });

  it("handles CRLF line endings and blank lines", () => {
    const ds = parseXY("S\r\n\r\n1 1\r\n2 2\r\n");
    expect(ds).toEqual([{ name: "S", x: [1, 2], y: [1, 2] }]);
  });
});

describe("parseY", () => {
  it("assigns a 1-based running index to x", () => {
    const ds = parseY("4.2\n-1\n0", "run");
    expect(ds).toEqual([{ name: "run", x: [1, 2, 3], y: [4.2, -1, 0] }]);
  });

  it("skips NaN lines without consuming an index", () => {
    const ds = parseY("1\nnope\n2\n\n3", "run");
    expect(ds[0].x).toEqual([1, 2, 3]);
    expect(ds[0].y).toEqual([1, 2, 3]);
  });

  it("names the single dataset after the provided base name", () => {
    expect(parseY("1\n2", "measurement_errors")[0].name).toBe("measurement_errors");
  });
});

describe("parseDataFile", () => {
  it("routes *.y to parseY with the extension-stripped base name", () => {
    const ds = parseDataFile("sensor_noise.y", "5\n6\n7");
    expect(ds).toEqual([{ name: "sensor_noise", x: [1, 2, 3], y: [5, 6, 7] }]);
  });

  it("routes *.xy to parseXY", () => {
    const ds = parseDataFile("scan.xy", "A\n1 2");
    expect(ds).toEqual([{ name: "A", x: [1], y: [2] }]);
  });

  it("matches the .y extension case-insensitively", () => {
    const ds = parseDataFile("SIGNAL.Y", "9\n8");
    expect(ds).toEqual([{ name: "SIGNAL", x: [1, 2], y: [9, 8] }]);
  });

  it("strips only the last .ext for the base name", () => {
    expect(parseDataFile("a.b.c.y", "1")[0].name).toBe("a.b.c");
  });
});
