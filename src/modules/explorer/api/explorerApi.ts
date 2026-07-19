import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  DEFAULT_NEW_FILE_NAME,
  DEFAULT_NEW_FOLDER_NAME,
} from "../domain/explorerDefaults";
import type {
  ExplorerAutoRefresh,
  ExplorerDropPayload,
  ExplorerEntry,
} from "../domain/explorerTypes";

export type { UnlistenFn };

export interface ExplorerApi {
  listDir(projectRoot: string, dirPath: string): Promise<ExplorerEntry[]>;
  createFile(projectRoot: string, parentDir: string, name?: string): Promise<ExplorerEntry>;
  createDir(projectRoot: string, parentDir: string, name?: string): Promise<ExplorerEntry>;
  rename(projectRoot: string, path: string, newName: string): Promise<ExplorerEntry>;
  trash(projectRoot: string, path: string): Promise<void>;
  duplicate(projectRoot: string, path: string): Promise<ExplorerEntry>;
  copyPaths(
    projectRoot: string,
    targetDir: string,
    sourcePaths: string[],
  ): Promise<ExplorerEntry[]>;
  watch(projectRoot: string, mode: ExplorerAutoRefresh): Promise<void>;
  unwatch(projectRoot: string): Promise<void>;
  reveal(path: string): Promise<void>;
  onChanged(callback: (projectRoot: string) => void): Promise<UnlistenFn>;
  onDrop(callback: (payload: ExplorerDropPayload) => void): Promise<UnlistenFn>;
}

export function createTauriExplorerApi(): ExplorerApi {
  return {
    listDir: (projectRoot, dirPath) =>
      invoke("explorer_list_dir", { input: { projectRoot, dirPath } }),
    createFile: (projectRoot, parentDir, name = DEFAULT_NEW_FILE_NAME) =>
      invoke("explorer_create_file", { input: { projectRoot, parentDir, name } }),
    createDir: (projectRoot, parentDir, name = DEFAULT_NEW_FOLDER_NAME) =>
      invoke("explorer_create_dir", { input: { projectRoot, parentDir, name } }),
    rename: (projectRoot, path, newName) =>
      invoke("explorer_rename", { input: { projectRoot, path, newName } }),
    trash: (projectRoot, path) => invoke("explorer_trash", { input: { projectRoot, path } }),
    duplicate: (projectRoot, path) =>
      invoke("explorer_duplicate", { input: { projectRoot, path } }),
    copyPaths: (projectRoot, targetDir, sourcePaths) =>
      invoke("explorer_copy_paths", { input: { projectRoot, targetDir, sourcePaths } }),
    watch: (projectRoot, mode) => invoke("explorer_watch", { input: { projectRoot, mode } }),
    unwatch: (projectRoot) => invoke("explorer_unwatch", { input: { projectRoot } }),
    reveal: (path) => invoke("explorer_reveal", { path }),
    onChanged: (callback) =>
      listen<{ projectRoot: string }>("explorer://changed", (event) =>
        callback(event.payload.projectRoot),
      ),
    onDrop: (callback) =>
      listen<ExplorerDropPayload>("explorer://drop", (event) => callback(event.payload)),
  };
}

export { createMemoryExplorerApi } from "./createMemoryExplorerApi";
export type { MemoryExplorerSeed } from "./createMemoryExplorerApi";
