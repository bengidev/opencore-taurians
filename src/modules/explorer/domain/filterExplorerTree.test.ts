import { describe, expect, it } from "vitest";
import { filterExplorerTree } from "./filterExplorerTree";
import type { ExplorerEntry } from "./explorerTypes";

const root = "/proj";
const src: ExplorerEntry = { name: "src", path: "/proj/src", isDir: true };
const lib: ExplorerEntry = { name: "lib", path: "/proj/lib", isDir: true };
const mainDart: ExplorerEntry = {
  name: "main.dart",
  path: "/proj/src/main.dart",
  isDir: false,
};
const readme: ExplorerEntry = {
  name: "README.md",
  path: "/proj/README.md",
  isDir: false,
};

const childrenByPath: Record<string, ExplorerEntry[]> = {
  [root]: [src, lib, readme],
  "/proj/src": [mainDart],
  "/proj/lib": [{ name: "util.ts", path: "/proj/lib/util.ts", isDir: false }],
};

describe("filterExplorerTree", () => {
  it("returns null for empty or whitespace query", () => {
    expect(
      filterExplorerTree({ childrenByPath, rootPath: root, query: "" }),
    ).toBeNull();
    expect(
      filterExplorerTree({ childrenByPath, rootPath: root, query: "  " }),
    ).toBeNull();
  });

  it("matches basenames case-insensitively", () => {
    const result = filterExplorerTree({
      childrenByPath,
      rootPath: root,
      query: "READ",
    });
    expect(result).not.toBeNull();
    expect(result!.childrenByPath[root]).toEqual([readme]);
  });

  it("keeps ancestors of nested matches and marks them display-open", () => {
    const result = filterExplorerTree({
      childrenByPath,
      rootPath: root,
      query: "main",
    });
    expect(result).not.toBeNull();
    expect(result!.childrenByPath[root]).toEqual([src]);
    expect(result!.childrenByPath["/proj/src"]).toEqual([mainDart]);
    expect(result!.childrenByPath["/proj/lib"]).toBeUndefined();
    expect(result!.displayOpenPaths.has("/proj/src")).toBe(true);
  });

  it("keeps a matching folder even when it has no matching children", () => {
    const result = filterExplorerTree({
      childrenByPath,
      rootPath: root,
      query: "lib",
    });
    expect(result).not.toBeNull();
    expect(result!.childrenByPath[root].map((e) => e.path)).toContain(
      "/proj/lib",
    );
    expect(result!.displayOpenPaths.has("/proj/lib")).toBe(false);
  });

  it("returns empty root children when nothing matches", () => {
    const result = filterExplorerTree({
      childrenByPath,
      rootPath: root,
      query: "zzz-nope",
    });
    expect(result).not.toBeNull();
    expect(result!.childrenByPath[root]).toEqual([]);
    expect(result!.displayOpenPaths.size).toBe(0);
  });
});
