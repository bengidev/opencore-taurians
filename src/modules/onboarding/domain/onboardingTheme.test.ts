import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_MODE, nextThemeMode, surface } from "./onboardingTheme";

describe("nextThemeMode", () => {
  it("switches dark to light", () => {
    expect(nextThemeMode("dark")).toBe("light");
  });

  it("switches light to dark", () => {
    expect(nextThemeMode("light")).toBe("dark");
  });
});

describe("theme tokens", () => {
  it("uses ink-deep as the dark primary surface", () => {
    expect(surface(DEFAULT_THEME_MODE, "primary")).toEqual({
      r: 16 / 255,
      g: 16 / 255,
      b: 16 / 255,
      a: 1,
    });
  });
});
