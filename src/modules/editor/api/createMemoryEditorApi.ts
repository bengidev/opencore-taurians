import type { EditorApi } from "./editorApi";

export interface MemoryEditorSeed {
  files?: Record<string, string>;
  directories?: string[];
}

export function createMemoryEditorApi(
  seed: MemoryEditorSeed = {},
): EditorApi & { files: Map<string, string>; directories: Set<string> } {
  const files = new Map<string, string>(Object.entries(seed.files ?? {}));
  const directories = new Set(seed.directories ?? []);

  const assertExists = (path: string): void => {
    if (!files.has(path)) {
      throw new Error(`Not found: ${path}`);
    }
  };

  return {
    files,
    directories,
    readFile: async (_projectRoot, path) => {
      assertExists(path);
      return files.get(path)!;
    },
    writeFile: async (_projectRoot, path, content) => {
      assertExists(path);
      files.set(path, content);
    },
    createFile: async (_projectRoot, path, content) => {
      files.set(path, content);
    },
    readExternalFile: async (path: string) => {
      assertExists(path);
      return files.get(path)!;
    },
    isUnderRoot: async (projectRoot: string, path: string) => {
      const root = projectRoot.endsWith("/") ? projectRoot.slice(0, -1) : projectRoot;
      return path === root || path.startsWith(`${root}/`);
    },
    pathsIncludeDirectory: async (paths: string[]) =>
      paths.some((p) => directories.has(p)),
  };
}
