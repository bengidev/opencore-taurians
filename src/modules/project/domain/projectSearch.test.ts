import { describe, expect, it } from "vitest";
import { projectMergeSearchResults } from "./projectSearch";

describe("projectMergeSearchResults", () => {
  it("ranks title hits before message hits and dedupes trunk ids", () => {
    const merged = projectMergeSearchResults({
      titleTrunkIds: ["c2", "c1"],
      messageTrunkIds: ["c1", "c3"],
    });
    expect(merged).toEqual(["c2", "c1", "c3"]);
  });
});
