import { describe, expect, it } from "vitest";
import {
  createMemoryEditorFilePicker,
} from "./editorFilePicker";

describe("editorFilePicker", () => {
  it("memory picker returns paths", async () => {
    const picker = createMemoryEditorFilePicker(["/a.ts", "/b.ts"]);
    await expect(picker.pickFiles()).resolves.toEqual(["/a.ts", "/b.ts"]);
  });

  it("memory picker cancel returns null", async () => {
    const picker = createMemoryEditorFilePicker(null);
    await expect(picker.pickFiles()).resolves.toBeNull();
  });
});
