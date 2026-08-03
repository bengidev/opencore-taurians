export const EDITOR_FONT_SIZE_MIN = 8;
export const EDITOR_FONT_SIZE_MAX = 32;
export const EDITOR_FONT_SIZE_DEFAULT = 13;

export function clampEditorFontSize(size: number): number {
  if (!Number.isFinite(size)) return EDITOR_FONT_SIZE_DEFAULT;
  return Math.min(
    EDITOR_FONT_SIZE_MAX,
    Math.max(EDITOR_FONT_SIZE_MIN, size),
  );
}
