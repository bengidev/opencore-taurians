import { describe, expect, it } from "vitest";
import {
  clampEditorFontSize,
  EDITOR_FONT_SIZE_DEFAULT,
  EDITOR_FONT_SIZE_MAX,
  EDITOR_FONT_SIZE_MIN,
} from "./editorFontScale";

describe("editorFontScale", () => {
  it("clamps values into range and falls back to default for non-finite", () => {
    expect(clampEditorFontSize(5)).toBe(EDITOR_FONT_SIZE_MIN);
    expect(clampEditorFontSize(40)).toBe(EDITOR_FONT_SIZE_MAX);
    expect(clampEditorFontSize(15)).toBe(15);
    expect(clampEditorFontSize(Number.NaN)).toBe(EDITOR_FONT_SIZE_DEFAULT);
  });
});
