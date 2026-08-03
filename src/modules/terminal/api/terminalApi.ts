import { invoke, Channel } from "@tauri-apps/api/core";
import type {
  TerminalGetSizeInput,
  TerminalGetSizeResult,
  TerminalKillInput,
  TerminalResizeInput,
  TerminalSessionInfo,
  TerminalSpawnInput,
  TerminalWriteInput,
  TerminalChannelMessage,
} from "./terminalContracts";

export interface TerminalApi {
  spawn(
    input: TerminalSpawnInput,
    onMessage: (message: TerminalChannelMessage) => void,
  ): Promise<TerminalSessionInfo>;
  write(input: TerminalWriteInput): Promise<void>;
  resize(input: TerminalResizeInput): Promise<void>;
  getSize(input: TerminalGetSizeInput): Promise<TerminalGetSizeResult>;
  kill(input: TerminalKillInput): Promise<void>;
}

export function createTauriTerminalApi(): TerminalApi {
  return {
    spawn: (input, onMessage) => {
      const channel = new Channel<TerminalChannelMessage>(onMessage);
      return invoke<TerminalSessionInfo>("terminal_spawn", { input, channel });
    },
    write: (input) => invoke<void>("terminal_write", { input }),
    resize: (input) => invoke<void>("terminal_resize", { input }),
    getSize: (input) => invoke<TerminalGetSizeResult>("terminal_get_size", { input }),
    kill: (input) => invoke<void>("terminal_kill", { input }),
  };
}
