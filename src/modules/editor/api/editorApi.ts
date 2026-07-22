import { invoke } from "@tauri-apps/api/core";

export interface EditorApi {
  readFile(projectRoot: string, path: string): Promise<string>;
  writeFile(projectRoot: string, path: string, content: string): Promise<void>;
}

export function createTauriEditorApi(): EditorApi {
  return {
    readFile: (projectRoot, path) =>
      invoke("editor_read_file", { input: { projectRoot, path } }),
    writeFile: (projectRoot, path, content) =>
      invoke("editor_write_file", { input: { projectRoot, path, content } }),
  };
}

export { createMemoryEditorApi } from "./createMemoryEditorApi";
export type { MemoryEditorSeed } from "./createMemoryEditorApi";
