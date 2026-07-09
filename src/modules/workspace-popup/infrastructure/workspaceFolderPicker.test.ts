import { describe, expect, it } from "vitest";
import { createMemoryFolderPicker } from "./workspaceFolderPicker";

describe("createMemoryFolderPicker", () => {
  it("returns the configured path", async () => {
    const picker = createMemoryFolderPicker("/Users/demo/project");
    await expect(picker.pickFolder()).resolves.toBe("/Users/demo/project");
  });

  it("returns null when cancelled", async () => {
    const picker = createMemoryFolderPicker(null);
    await expect(picker.pickFolder()).resolves.toBeNull();
  });
});
