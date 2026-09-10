/**
 * Per-dataset color configuration. Ported verbatim from the source browser app
 * (xy_plot_viewer.html).
 */
import { DEFAULT_PALETTE } from "./palette";

export interface ColorConfig {
  palette: string[];
  datasetColors: Record<string, string>;
}

export function makeColorConfig(palette: string[] = DEFAULT_PALETTE): ColorConfig {
  return { palette: [...palette], datasetColors: {} };
}

/**
 * Resolved color for a dataset: a per-name override wins; otherwise the palette
 * cycled by `paletteIndex % palette.length` (falling back to the default palette
 * if the configured one is empty).
 */
export function getColor(cfg: ColorConfig, name: string, paletteIndex: number): string {
  if (Object.prototype.hasOwnProperty.call(cfg.datasetColors, name)) {
    return cfg.datasetColors[name];
  }
  const palette = cfg.palette.length ? cfg.palette : DEFAULT_PALETTE;
  return palette[paletteIndex % palette.length];
}

export function setColor(cfg: ColorConfig, name: string, color: string): void {
  cfg.datasetColors[name] = color;
}

export function clearAllColors(cfg: ColorConfig): void {
  cfg.datasetColors = {};
}
