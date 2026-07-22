import { describe, expect, it } from "vitest";
import {
  explorerDeleteConfirmMessage,
  matchingEditorTabIdsForDelete,
} from "./explorerDeleteEditorTabs";

describe("matchingEditorTabIdsForDelete", () => {
  it("matches exact file path only", () => {
    expect(
      matchingEditorTabIdsForDelete(
        ["/proj/a.ts", "/proj/b.ts", "untitled:1"],
        "/proj/a.ts",
        false,
      ),
    ).toEqual(["/proj/a.ts"]);
  });

  it("cascades under deleted folder", () => {
    expect(
      matchingEditorTabIdsForDelete(
        ["/proj/src/a.ts", "/proj/src", "/proj/other.ts", "untitled:1"],
        "/proj/src",
        true,
      ),
    ).toEqual(["/proj/src/a.ts", "/proj/src"]);
  });

  it("does not treat sibling prefix paths as under a folder", () => {
    expect(
      matchingEditorTabIdsForDelete(
        ["/proj/src2/a.ts", "/proj/src/a.ts"],
        "/proj/src",
        true,
      ),
    ).toEqual(["/proj/src/a.ts"]);
  });
});

describe("explorerDeleteConfirmMessage", () => {
  it("omits tab warning when count is 0", () => {
    expect(explorerDeleteConfirmMessage("a.ts", 0)).toBe('Move "a.ts" to Trash?');
  });

  it("includes tab warning when count > 0", () => {
    expect(explorerDeleteConfirmMessage("src", 2)).toBe(
      'Move "src" to Trash?\n\n2 open editor tab(s) will close. Unsaved changes will be discarded.',
    );
  });
});
