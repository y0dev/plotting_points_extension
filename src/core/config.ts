/**
 * Config serialize / deserialize. The on-disk shape and the fallback defaults
 * are ported verbatim from the source browser app (xy_plot_viewer.html):
 * `Save Config` there wrote exactly this JSON and `Load Config` restored it,
 * tolerant of missing keys, with `showLegend` treated as `!== false`.
 */
import { DEFAULT_PALETTE } from "./palette";
import { ColorConfig } from "./colorConfig";
import { makeTitleSettings, TitleSettings } from "./titleSettings";
import { Visibility } from "./visibility";

/** The slice of application state that a config file captures. */
export interface PlotState {
  colors: ColorConfig;
  plotSettings: TitleSettings;
  histSettings: TitleSettings;
  visibility: Visibility;
}

export interface SerializedConfig {
  colors: { palette: string[]; dataset_colors: Record<string, string> };
  plot_settings: TitleSettings;
  histogram_settings: TitleSettings;
  visibility: { hidden_names: string[] };
}

export function serializeConfig(state: PlotState): SerializedConfig {
  return {
    colors: {
      palette: state.colors.palette,
      dataset_colors: state.colors.datasetColors,
    },
    plot_settings: state.plotSettings,
    histogram_settings: state.histSettings,
    visibility: { hidden_names: Array.from(state.visibility.hiddenNames) },
  };
}

type AnyRecord = Record<string, unknown>;

/**
 * Restore a config into `state`, mutating it in place (matching the source
 * app's Load Config). Missing keys fall back to the same defaults the app uses;
 * `showLegend` is `!== false`.
 */
export function deserializeConfig(raw: AnyRecord, state: PlotState): void {
  const colors = raw.colors as AnyRecord | undefined;
  state.colors.palette = (colors?.palette as string[]) || [...DEFAULT_PALETTE];
  state.colors.datasetColors =
    (colors?.dataset_colors as Record<string, string>) || {};

  const plot = raw.plot_settings as AnyRecord | undefined;
  state.plotSettings = makeTitleSettings({
    xlabel: (plot?.xlabel as string) || "Run",
    ylabel: (plot?.ylabel as string) || "Value",
    showLegend: plot ? plot.showLegend !== false : true,
  });
  if (plot?.overrides) {
    state.plotSettings.overrides = plot.overrides as TitleSettings["overrides"];
  }

  const hist = raw.histogram_settings as AnyRecord | undefined;
  state.histSettings = makeTitleSettings({
    bins: (hist?.bins as number) || 20,
    xlabel: (hist?.xlabel as string) || "Value",
    ylabel: (hist?.ylabel as string) || "Count",
    showLegend: hist ? hist.showLegend !== false : true,
  });
  if (hist?.overrides) {
    state.histSettings.overrides = hist.overrides as TitleSettings["overrides"];
  }

  const visibility = raw.visibility as AnyRecord | undefined;
  state.visibility.hiddenNames = new Set(
    (visibility?.hidden_names as string[]) || [],
  );
}
