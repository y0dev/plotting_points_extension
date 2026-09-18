/**
 * File-name-based axis-label defaults ("naming rules"). Pure, no `vscode` / DOM
 * — the extension host reads `xyPlot.namingRules` (merged across the User and
 * Workspace setting scopes) and forwards the plain array here; this module only
 * knows how to match and merge it.
 *
 * A rule's `match` is a small glob (`*` only, case-insensitive) tested against
 * a file's **original title** (its name with the extension stripped) — the
 * same identity the title/label override system already keys on. Rules are
 * applied in array order and merged field-by-field, so a later rule overrides
 * only the fields it sets; it does not blank out fields an earlier rule set.
 * Callers layer this *underneath* any explicit per-title override the user has
 * saved — an override always wins.
 */

export interface NamingRule {
  match: string;
  xlabel?: string;
  ylabel?: string;
  title?: string;
}

export interface NamingLabels {
  xlabel?: string;
  ylabel?: string;
  title?: string;
}

/** `*` is the only wildcard; everything else matches literally, case-insensitively. */
export function matchesPattern(pattern: string, name: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i").test(name);
}

/**
 * Resolve the naming-rule-derived labels for `originalTitle` by merging every
 * matching rule in order (later matches win per-field). Returns `{}` when
 * nothing matches.
 */
export function resolveNamingLabels(rules: NamingRule[], originalTitle: string): NamingLabels {
  const result: NamingLabels = {};
  for (const rule of rules) {
    if (!rule || !matchesPattern(rule.match, originalTitle)) continue;
    if (rule.xlabel) result.xlabel = rule.xlabel;
    if (rule.ylabel) result.ylabel = rule.ylabel;
    if (rule.title) result.title = rule.title;
  }
  return result;
}
