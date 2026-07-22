import { describe, expect, it } from "vitest";
import type { EditorBuffer } from "../state/editorStore";
import { collectDirtyExplorerPaths } from "./collectDirtyExplorerPaths";

function buf(partial: Partial<EditorBuffer> & Pick<EditorBuffer, "dirty">): EditorBuffer {
  return {
    content: "",
    baselineContent: "",
    status: "ready",
    errorMessage: null,
    saveError: null,
    readOnly: false,
    ...partial,
  };
}

describe("collectDirtyExplorerPaths", () => {
  it("includes dirty file and ancestor dirs through projectRoot", () => {
    const set = collectDirtyExplorerPaths(
      {
        "/proj/src/a.ts": buf({ dirty: true }),
      },
      "/proj",
    );
    expect(set.has("/proj/src/a.ts")).toBe(true);
    expect(set.has("/proj/src")).toBe(true);
    expect(set.has("/proj")).toBe(true);
  });

  it("ignores clean, Untitled, readOnly, and outside-project paths", () => {
    const set = collectDirtyExplorerPaths(
      {
        "/proj/clean.ts": buf({ dirty: false }),
        "untitled:1": buf({ dirty: true }),
        "/tmp/out.ts": buf({ dirty: true, readOnly: true }),
        "/other/x.ts": buf({ dirty: true }),
      },
      "/proj",
    );
    expect(set.size).toBe(0);
  });

  it("returns empty set when projectRoot is null", () => {
    expect(
      collectDirtyExplorerPaths({ "/proj/a.ts": buf({ dirty: true }) }, null).size,
    ).toBe(0);
  });
});
