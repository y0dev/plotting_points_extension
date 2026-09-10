/**
 * Dataset visibility, tracked as a set of hidden names. Ported verbatim from the
 * source browser app (xy_plot_viewer.html).
 */

export interface Visibility {
  hiddenNames: Set<string>;
}

export function makeVisibility(): Visibility {
  return { hiddenNames: new Set<string>() };
}

export function isVisible(vis: Visibility, name: string): boolean {
  return !vis.hiddenNames.has(name);
}

export function setVisible(vis: Visibility, name: string, visible: boolean): void {
  if (visible) vis.hiddenNames.delete(name);
  else vis.hiddenNames.add(name);
}

/** With no `names`, clears every hidden entry; otherwise un-hides just `names`. */
export function showAllVisible(vis: Visibility, names?: string[]): void {
  if (!names) {
    vis.hiddenNames.clear();
    return;
  }
  names.forEach((n) => vis.hiddenNames.delete(n));
}

export function hideAllVisible(vis: Visibility, names: string[]): void {
  names.forEach((n) => vis.hiddenNames.add(n));
}
