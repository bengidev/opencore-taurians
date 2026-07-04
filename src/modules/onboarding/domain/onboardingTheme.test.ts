import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_THEME_MODE,
  applyThemeToDocument,
  nextThemeMode,
  surface,
} from "./onboardingTheme";
import {
  THEME_STORAGE_KEY,
} from "../infrastructure/onboardingThemeConstants";

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

describe("applyThemeToDocument", () => {
  it("toggles dark class without injecting unused --oc-* variables", () => {
    applyThemeToDocument("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--oc-fg-primary")).toBe(
      "",
    );

    applyThemeToDocument("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("theme boot script", () => {
  it("matches shared storage constants", () => {
    const bootScript = readFileSync(
      resolve(process.cwd(), "public/theme-boot.js"),
      "utf8",
    );
    expect(bootScript).toContain(THEME_STORAGE_KEY);
    expect(bootScript).toContain(DEFAULT_THEME_MODE);
  });
});
