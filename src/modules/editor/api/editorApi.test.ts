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

  it("createFile creates missing paths and overwrites existing", async () => {
    const api = createMemoryEditorApi({ files: { "/proj/a.txt": "old" } });
    await api.createFile("/proj", "/proj/b.txt", "new");
    expect(await api.readFile("/proj", "/proj/b.txt")).toBe("new");
    await api.createFile("/proj", "/proj/a.txt", "replaced");
    expect(await api.readFile("/proj", "/proj/a.txt")).toBe("replaced");
  });

  it("writeFile still rejects missing files", async () => {
    const api = createMemoryEditorApi();
    await expect(api.writeFile("/proj", "/proj/missing.txt", "x")).rejects.toThrow(/not found/i);
  });

  it("readExternalFile returns seeded outside path", async () => {
    const api = createMemoryEditorApi({
      files: { "/tmp/out.txt": "ext" },
    });
    await expect(api.readExternalFile("/tmp/out.txt")).resolves.toBe("ext");
  });

  it("isUnderRoot uses projectRoot prefix semantics in memory", async () => {
    const api = createMemoryEditorApi();
    await expect(api.isUnderRoot("/proj", "/proj/a.ts")).resolves.toBe(true);
    await expect(api.isUnderRoot("/proj", "/other/a.ts")).resolves.toBe(false);
  });

  it("pathsIncludeDirectory respects directories seed", async () => {
    const api = createMemoryEditorApi({
      directories: ["/tmp/folder"],
    });
    await expect(api.pathsIncludeDirectory(["/tmp/folder", "/tmp/a.txt"])).resolves.toBe(
      true,
    );
    await expect(api.pathsIncludeDirectory(["/tmp/a.txt"])).resolves.toBe(false);
  });
});
