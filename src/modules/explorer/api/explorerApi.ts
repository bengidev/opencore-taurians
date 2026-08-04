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

export interface WatchChangeEvent {
  root: string;
  revision: number;
  kinds: string[];
}

export interface WatchSubscribeInput {
  scopeId: string;
  mode: ExplorerAutoRefresh;
  identity: string;
}

export interface WatchUnsubscribeInput {
  scopeId: string;
  identity: string;
}

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
  watchSubscribe(input: WatchSubscribeInput): Promise<void>;
  watchUnsubscribe(input: WatchUnsubscribeInput): Promise<void>;
  reveal(path: string): Promise<void>;
  onChanged(callback: (root: string) => void): Promise<UnlistenFn>;
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
    watchSubscribe: (input) => invoke("watch_subscribe", { input }),
    watchUnsubscribe: (input) => invoke("watch_unsubscribe", { input }),
    reveal: (path) => invoke("explorer_reveal", { path }),
    onChanged: (callback) =>
      listen<WatchChangeEvent>("watch://changed", (event) =>
        callback(event.payload.root),
      ),
    onDrop: (callback) =>
      listen<ExplorerDropPayload>("explorer://drop", (event) => callback(event.payload)),
  };
}

export { createMemoryExplorerApi } from "./explorerMemoryApi";
export type { MemoryExplorerSeed } from "./explorerMemoryApi";
