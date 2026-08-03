export interface TerminalSpawnInput {
  cwd: string;
  cols: number;
  rows: number;
}

export interface TerminalSessionInfo {
  sessionId: string;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
}

export interface TerminalWriteInput {
  sessionId: string;
  data: string;
}

export interface TerminalResizeInput {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface TerminalGetSizeInput {
  sessionId: string;
}

export interface TerminalGetSizeResult {
  cols: number;
  rows: number;
}

export interface TerminalKillInput {
  sessionId: string;
}

export interface TerminalOutputChunk {
  data: string; // base64
}

export interface TerminalExitEvent {
  sessionId: string;
  exitCode: number | null;
  signal: string | null;
}

export type TerminalChannelMessage =
  | { kind: "Output"; payload: TerminalOutputChunk }
  | { kind: "Exit"; payload: TerminalExitEvent };

export type PublicTerminalError =
  | { error: "ShellNotFound" }
  | { error: "InvalidWorkingDirectory"; path: string }
  | { error: "SpawnFailed"; message: string }
  | { error: "SessionNotFound"; sessionId: string }
  | { error: "WriteFailed"; message: string }
  | { error: "ResizeFailed"; message: string };
