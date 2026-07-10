import { describe, expect, it } from "vitest";
import { projectMergeSearchResults } from "./projectSearch";

describe("projectMergeSearchResults", () => {
  it("ranks title hits before message hits and dedupes chunk ids", () => {
    const merged = projectMergeSearchResults({
      titleChunkIds: ["c2", "c1"],
      messageChunkIds: ["c1", "c3"],
    });
    expect(merged).toEqual(["c2", "c1", "c3"]);
  });
});
