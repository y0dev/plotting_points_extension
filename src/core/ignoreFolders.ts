/**
 * Filters the Data Files Activity Bar view by directory name, driven by the
 * `xyPlot.ignoreFolders` setting. Pure, no `vscode` / DOM.
 *
 * A term matches a path segment if the segment **contains** it, case-
 * insensitively — "archive" ignores a folder named `archive`, `old_archive`,
 * or `Archived_2024` alike. Only directory segments are checked, never the
 * file name itself.
 */

/** Split a relative path into its directory segments (the file name dropped). */
function directorySegments(relativePath: string): string[] {
  return relativePath.split(/[\\/]+/).filter(Boolean).slice(0, -1);
}

/**
 * True when any directory segment of `relativePath` contains one of
 * `ignoreTerms` (case-insensitive substring match). Empty / blank terms are
 * ignored, so `[""]` or `[]` never matches anything.
 */
export function isIgnoredPath(relativePath: string, ignoreTerms: string[]): boolean {
  const terms = ignoreTerms.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
  if (!terms.length) return false;

  const segments = directorySegments(relativePath).map((s) => s.toLowerCase());
  return segments.some((segment) => terms.some((term) => segment.includes(term)));
}
