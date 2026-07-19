import { describe, expect, it } from "vitest";
import { createMemoryExplorerApi } from "./createMemoryExplorerApi";

describe("createMemoryExplorerApi", () => {
  it("lists seeded entries", async () => {
    const projectRoot = "/project";
    const api = createMemoryExplorerApi({
      projectRoot,
      dirs: {
        [projectRoot]: [
          { name: "src", path: "/project/src", isDir: true },
          { name: "readme.md", path: "/project/readme.md", isDir: false },
        ],
      },
    });

    await expect(api.listDir(projectRoot, projectRoot)).resolves.toEqual([
      { name: "src", path: "/project/src", isDir: true },
      { name: "readme.md", path: "/project/readme.md", isDir: false },
    ]);
  });
});
