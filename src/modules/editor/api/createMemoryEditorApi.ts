import type { EditorApi } from "./editorApi";

export interface MemoryEditorSeed {
  files?: Record<string, string>;
}

export function createMemoryEditorApi(
  seed: MemoryEditorSeed = {},
): EditorApi & { files: Map<string, string> } {
  const files = new Map<string, string>(Object.entries(seed.files ?? {}));

  const assertExists = (path: string): void => {
    if (!files.has(path)) {
      throw new Error(`Not found: ${path}`);
    }
  };

  return {
    files,
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
  };
}
