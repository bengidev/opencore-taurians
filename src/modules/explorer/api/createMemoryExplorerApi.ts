import type { UnlistenFn } from "@tauri-apps/api/event";
import type { ExplorerApi } from "./explorerApi";
import type {
  ExplorerAutoRefresh,
  ExplorerDropPayload,
  ExplorerEntry,
} from "../domain/explorerTypes";

export interface MemoryExplorerSeed {
  projectRoot?: string;
  dirs?: Record<string, ExplorerEntry[]>;
}

function joinPath(parent: string, name: string): string {
  const base = parent.endsWith("/") ? parent.slice(0, -1) : parent;
  return `${base}/${name}`;
}

function parentDir(path: string): string {
  const index = path.lastIndexOf("/");
  return index <= 0 ? path : path.slice(0, index);
}

function duplicateName(name: string, isDir: boolean): string {
  if (isDir) {
    return `${name} copy`;
  }
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) {
    return `${name} copy`;
  }
  return `${name.slice(0, dotIndex)} copy${name.slice(dotIndex)}`;
}

export function createMemoryExplorerApi(seed: MemoryExplorerSeed = {}): ExplorerApi {
  const projectRoot = seed.projectRoot ?? "/project";
  const dirs = new Map<string, ExplorerEntry[]>(
    Object.entries(seed.dirs ?? { [projectRoot]: [] }),
  );

  const getDirEntries = (dirPath: string): ExplorerEntry[] => {
    if (!dirs.has(dirPath)) {
      dirs.set(dirPath, []);
    }
    return dirs.get(dirPath)!;
  };

  const findEntry = (path: string): { parentDir: string; entry: ExplorerEntry } | null => {
    const parent = parentDir(path);
    const entries = dirs.get(parent);
    if (!entries) {
      return null;
    }
    const entry = entries.find((item) => item.path === path);
    return entry ? { parentDir: parent, entry } : null;
  };

  const removeEntry = (path: string): void => {
    const located = findEntry(path);
    if (!located) {
      return;
    }
    const entries = getDirEntries(located.parentDir);
    const index = entries.findIndex((item) => item.path === path);
    if (index >= 0) {
      entries.splice(index, 1);
    }
  };

  return {
    listDir: async (_projectRoot, dirPath) => [...getDirEntries(dirPath)],
    createFile: async (_projectRoot, parentDirPath, name = "untitled") => {
      const entry: ExplorerEntry = {
        name,
        path: joinPath(parentDirPath, name),
        isDir: false,
      };
      getDirEntries(parentDirPath).push(entry);
      return entry;
    },
    createDir: async (_projectRoot, parentDirPath, name = "New Folder") => {
      const entry: ExplorerEntry = {
        name,
        path: joinPath(parentDirPath, name),
        isDir: true,
      };
      getDirEntries(parentDirPath).push(entry);
      dirs.set(entry.path, []);
      return entry;
    },
    rename: async (_projectRoot, path, newName) => {
      const located = findEntry(path);
      if (!located) {
        throw new Error(`Not found: ${path}`);
      }
      const nextPath = joinPath(located.parentDir, newName);
      if (located.entry.isDir) {
        const children = dirs.get(path);
        if (children) {
          dirs.delete(path);
          dirs.set(nextPath, children);
        }
      }
      located.entry.name = newName;
      located.entry.path = nextPath;
      return { ...located.entry };
    },
    trash: async (_projectRoot, path) => {
      if (dirs.has(path)) {
        dirs.delete(path);
      }
      removeEntry(path);
    },
    duplicate: async (_projectRoot, path) => {
      const located = findEntry(path);
      if (!located) {
        throw new Error(`Not found: ${path}`);
      }
      const copyName = duplicateName(located.entry.name, located.entry.isDir);
      const copy: ExplorerEntry = {
        name: copyName,
        path: joinPath(located.parentDir, copyName),
        isDir: located.entry.isDir,
      };
      getDirEntries(located.parentDir).push(copy);
      if (copy.isDir) {
        dirs.set(copy.path, []);
      }
      return copy;
    },
    copyPaths: async (_projectRoot, targetDir, sourcePaths) => {
      const copied: ExplorerEntry[] = [];
      for (const sourcePath of sourcePaths) {
        const fileName = sourcePath.split("/").pop();
        if (!fileName) {
          continue;
        }
        const entry: ExplorerEntry = {
          name: fileName,
          path: joinPath(targetDir, fileName),
          isDir: false,
        };
        getDirEntries(targetDir).push(entry);
        copied.push(entry);
      }
      return copied;
    },
    watch: async (_projectRoot, _mode: ExplorerAutoRefresh) => {},
    unwatch: async (_projectRoot) => {},
    reveal: async (_path) => {},
    onChanged: async (_callback) => (() => {}) satisfies UnlistenFn,
    onDrop: async (_callback: (payload: ExplorerDropPayload) => void) =>
      (() => {}) satisfies UnlistenFn,
  };
}
