import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_MODE, nextThemeMode, surface } from "./theme";

describe("nextThemeMode", () => {
  it("switches dark to light", () => {
    expect(nextThemeMode("dark")).toBe("light");
  });

  it("switches light to dark", () => {
    expect(nextThemeMode("light")).toBe("dark");
  });
});

describe("theme tokens", () => {
  it("uses a dark primary surface by default", () => {
    expect(surface(DEFAULT_THEME_MODE, "primary")).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 1,
    });
  });
});
