import { describe, expect, it } from "vitest";
import {
  GUI_SCALE_DEFAULT,
  GUI_SCALE_MAX,
  GUI_SCALE_MIN,
  clampGuiScale,
  guiScaleAfterWorkAreaClamp,
  maxGuiScaleForWorkArea,
  scaledWindowSize,
} from "./sessionGuiScale";

describe("sessionGuiScale", () => {
  it("clamps into absolute range", () => {
    expect(clampGuiScale(0.1)).toBe(GUI_SCALE_MIN);
    expect(clampGuiScale(3)).toBe(GUI_SCALE_MAX);
    expect(clampGuiScale(1.23)).toBe(1.23);
    expect(clampGuiScale(Number.NaN)).toBe(GUI_SCALE_DEFAULT);
  });

  it("clamps to maxFit when provided", () => {
    expect(clampGuiScale(2, 1.25)).toBe(1.25);
    expect(clampGuiScale(1.1, 1.25)).toBe(1.1);
  });

  it("computes max fit from work area and base", () => {
    expect(
      maxGuiScaleForWorkArea(
        { width: 1280, height: 800 },
        { width: 1920, height: 1080 },
      ),
    ).toBe(1.35); // min(2, 1920/1280, 1080/800) = min(2, 1.5, 1.35)
  });

  it("clamps guiScale when max fit is below current scale", () => {
    expect(
      guiScaleAfterWorkAreaClamp(
        2,
        { width: 1280, height: 800 },
        { width: 1920, height: 1080 },
      ),
    ).toBe(1.35);
  });

  it("falls back to absolute clamp when work area is unknown", () => {
    expect(
      guiScaleAfterWorkAreaClamp(2, { width: 1280, height: 800 }, null),
    ).toBe(GUI_SCALE_MAX);
    expect(
      guiScaleAfterWorkAreaClamp(0.1, { width: 1280, height: 800 }, null),
    ).toBe(GUI_SCALE_MIN);
  });

  it("scales window size and clamps to work area", () => {
    expect(
      scaledWindowSize({ width: 1280, height: 800 }, 1.5),
    ).toEqual({ width: 1920, height: 1200 });
    expect(
      scaledWindowSize(
        { width: 1280, height: 800 },
        2,
        { width: 1800, height: 1000 },
      ),
    ).toEqual({ width: 1800, height: 1000 });
  });
});
