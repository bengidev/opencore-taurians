export interface ExplorerEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export type ExplorerAutoRefresh = "live" | "on-activate";

export interface ExplorerDropPayload {
  paths: string[];
  x: number;
  y: number;
}
