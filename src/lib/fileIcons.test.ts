import { describe, expect, it } from "vitest";
import { resolveExplorerIcon } from "./fileIcons";

describe("resolveExplorerIcon", () => {
  it("maps file extensions and special basenames to Material icon ids", () => {
    expect(resolveExplorerIcon({ name: "main.dart", isDir: false }).iconId).toBe(
      "dart",
    );
    expect(resolveExplorerIcon({ name: "a.ts", isDir: false }).iconId).toBe(
      "typescript",
    );
    expect(resolveExplorerIcon({ name: "foo.test.ts", isDir: false }).iconId).toBe(
      "test-ts",
    );
    expect(resolveExplorerIcon({ name: "package.json", isDir: false }).iconId).toBe(
      "nodejs",
    );
    expect(resolveExplorerIcon({ name: "PACKAGE.JSON", isDir: false }).iconId).toBe(
      "nodejs",
    );
    expect(resolveExplorerIcon({ name: "README.md", isDir: false }).iconId).toBe(
      "readme",
    );
    expect(resolveExplorerIcon({ name: ".env", isDir: false }).iconId).toBe("tune");
    expect(resolveExplorerIcon({ name: ".env.local", isDir: false }).iconId).toBe(
      "tune",
    );
    expect(resolveExplorerIcon({ name: "Dockerfile", isDir: false }).iconId).toBe(
      "docker",
    );
  });

  it("falls back to Material default file icon", () => {
    expect(resolveExplorerIcon({ name: "mystery", isDir: false }).iconId).toBe(
      "file",
    );
  });

  it("maps folders including open state and named folders", () => {
    expect(
      resolveExplorerIcon({ name: "lib", isDir: true, isOpen: false }).iconId,
    ).toBe("folder-lib");
    expect(
      resolveExplorerIcon({ name: "lib", isDir: true, isOpen: true }).iconId,
    ).toBe("folder-lib-open");
    expect(
      resolveExplorerIcon({ name: "src", isDir: true, isOpen: false }).iconId,
    ).toBe("folder-src");
    expect(
      resolveExplorerIcon({ name: "src", isDir: true, isOpen: true }).iconId,
    ).toBe("folder-src-open");
  });

  it("returns a non-empty src string for resolved icons", () => {
    const file = resolveExplorerIcon({ name: "main.dart", isDir: false });
    expect(file.src.length).toBeGreaterThan(0);
    expect(file.src).toMatch(/dart\.svg/i);

    const folder = resolveExplorerIcon({
      name: "src",
      isDir: true,
      isOpen: true,
    });
    expect(folder.src.length).toBeGreaterThan(0);
    expect(folder.src).toMatch(/folder-src-open\.svg/i);
  });
});
