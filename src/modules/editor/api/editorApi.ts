import { invoke } from "@tauri-apps/api/core";

export interface EditorApi {
  readFile(projectRoot: string, path: string): Promise<string>;
  writeFile(projectRoot: string, path: string, content: string): Promise<void>;
  createFile(projectRoot: string, path: string, content: string): Promise<void>;
  readExternalFile(path: string): Promise<string>;
  isUnderRoot(projectRoot: string, path: string): Promise<boolean>;
  pathsIncludeDirectory(paths: string[]): Promise<boolean>;
}

export function createTauriEditorApi(): EditorApi {
  return {
    readFile: (projectRoot, path) =>
      invoke("editor_read_file", { input: { projectRoot, path } }),
    writeFile: (projectRoot, path, content) =>
      invoke("editor_write_file", { input: { projectRoot, path, content } }),
    createFile: (projectRoot, path, content) =>
      invoke("editor_create_file", { input: { projectRoot, path, content } }),
    readExternalFile: (path) =>
      invoke("editor_read_external_file", { input: { path } }),
    isUnderRoot: (projectRoot, path) =>
      invoke("editor_is_under_root", { input: { projectRoot, path } }),
    pathsIncludeDirectory: (paths) =>
      invoke("editor_paths_include_directory", { input: { paths } }),
  };
}

export { createMemoryEditorApi } from "./createMemoryEditorApi";
export type { MemoryEditorSeed } from "./createMemoryEditorApi";
