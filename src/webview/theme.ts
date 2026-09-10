/**
 * Resolve a {@link Theme} from the VS Code CSS custom properties that VS Code
 * injects into every webview. Falls back to the source app's light values if a
 * variable is missing (e.g. in a bare test host).
 */
import type { Theme } from "./render";

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return v || fallback;
}

/** Parse `#rgb` / `#rrggbb` / `rgb()/rgba()` into `[r, g, b]`, else `null`. */
function toRgb(color: string): [number, number, number] | null {
  const c = color.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) {
    const h = m[1];
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) {
    const h = m[1];
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(c);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

/** A translucent version of `color` for grid lines. */
export function translucent(color: string, alpha = 0.14): string {
  const rgb = toRgb(color);
  if (!rgb) return `rgba(128, 128, 128, ${alpha})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function readTheme(): Theme {
  const bg = cssVar("--vscode-editor-background", "#ffffff");
  const fg = cssVar("--vscode-foreground", "#1c2733");
  return { bg, fg, grid: translucent(fg) };
}
