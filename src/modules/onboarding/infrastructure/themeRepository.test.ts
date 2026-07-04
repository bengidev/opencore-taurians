import { describe, expect, it } from "vitest";
import { LocalStorageThemeRepository } from "./themeRepository";

describe("LocalStorageThemeRepository", () => {
  it("returns dark when nothing is stored", () => {
    const repository = new LocalStorageThemeRepository("test-theme");
    expect(repository.load()).toBe("dark");
  });

  it("persists the selected theme mode", () => {
    const repository = new LocalStorageThemeRepository("test-theme");
    repository.save("light");
    expect(repository.load()).toBe("light");
  });
});
