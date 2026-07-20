export type GuiWindowSize = { width: number; height: number };

export const GUI_SCALE_MIN = 0.5;
export const GUI_SCALE_MAX = 2;
export const GUI_SCALE_STEP = 0.05;
export const GUI_SCALE_DEFAULT = 1;

export function clampGuiScale(scale: number, maxFit = GUI_SCALE_MAX): number {
  if (!Number.isFinite(scale)) return GUI_SCALE_DEFAULT;
  const upper = Math.min(GUI_SCALE_MAX, Math.max(GUI_SCALE_MIN, maxFit));
  return Math.min(upper, Math.max(GUI_SCALE_MIN, scale));
}

export function maxGuiScaleForWorkArea(
  base: GuiWindowSize,
  workArea: GuiWindowSize,
): number {
  if (base.width <= 0 || base.height <= 0) return GUI_SCALE_MIN;
  const byWidth = workArea.width / base.width;
  const byHeight = workArea.height / base.height;
  return clampGuiScale(Math.min(GUI_SCALE_MAX, byWidth, byHeight));
}

export function guiScaleAfterWorkAreaClamp(
  scale: number,
  base: GuiWindowSize,
  workArea: GuiWindowSize | null,
): number {
  if (!workArea) return clampGuiScale(scale);
  return clampGuiScale(scale, maxGuiScaleForWorkArea(base, workArea));
}

export function scaledWindowSize(
  base: GuiWindowSize,
  scale: number,
  workArea?: GuiWindowSize | null,
): GuiWindowSize {
  const s = clampGuiScale(scale);
  let width = Math.round(base.width * s);
  let height = Math.round(base.height * s);
  if (workArea) {
    width = Math.min(width, workArea.width);
    height = Math.min(height, workArea.height);
  }
  return { width, height };
}
