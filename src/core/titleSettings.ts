/**
 * Per-plot title / axis-label overrides, keyed by a plot's "original title"
 * (the filename with its extension stripped). Ported verbatim from the source
 * browser app (xy_plot_viewer.html).
 *
 * A `TitleSettings` object carries the mode-global defaults for a view
 * (`xlabel`, `ylabel`, `bins`, `showLegend`) plus an `overrides` map. Each
 * override may set `displayTitle`, and — for line mode — `xlabel` / `ylabel`
 * per title.
 */

export interface TitleOverride {
  displayTitle?: string;
  xlabel?: string;
  ylabel?: string;
  [field: string]: string | undefined;
}

export interface TitleSettings {
  overrides: Record<string, TitleOverride>;
  xlabel?: string;
  ylabel?: string;
  bins?: number;
  showLegend?: boolean;
}

export function makeTitleSettings(defaults: Partial<TitleSettings> = {}): TitleSettings {
  return Object.assign({ overrides: {} }, defaults) as TitleSettings;
}

export function getDisplayTitle(settings: TitleSettings, originalTitle: string): string {
  const o = settings.overrides[originalTitle];
  return o && o.displayTitle ? o.displayTitle : originalTitle;
}

export function getFieldOr<T>(
  settings: TitleSettings,
  originalTitle: string,
  field: string,
  fallback: T,
): T | string {
  const o = settings.overrides[originalTitle];
  return o && o[field] ? (o[field] as string) : fallback;
}

export function setOverrideField(
  settings: TitleSettings,
  originalTitle: string,
  field: string,
  value: string,
): void {
  if (!settings.overrides[originalTitle]) settings.overrides[originalTitle] = {};
  settings.overrides[originalTitle][field] = value;
}
