import { describe, expect, it } from "vitest";
import { createMemoryEditorApi } from "./createMemoryEditorApi";

describe("createMemoryEditorApi", () => {
  it("reads and writes seeded files", async () => {
    const api = createMemoryEditorApi({
      files: { "/proj/a.ts": "export {};" },
    });
    await expect(api.readFile("/proj", "/proj/a.ts")).resolves.toBe("export {};");
    await api.writeFile("/proj", "/proj/a.ts", "x");
    await expect(api.readFile("/proj", "/proj/a.ts")).resolves.toBe("x");
  });

  it("rejects missing files on read", async () => {
    const api = createMemoryEditorApi();
    await expect(api.readFile("/proj", "/proj/missing.ts")).rejects.toThrow(/not found/i);
  });
});
