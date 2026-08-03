import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

import { useProjectStore } from "../../project/state/projectStore";
import { useTerminalStore } from "../state/terminalStore";
import { createTauriTerminalApi } from "../api/terminalApi";
import type { TerminalChannelMessage } from "../api/terminalContracts";
import { TerminalPlaceholder } from "./TerminalPlaceholder";

const tauriTerminalApi = createTauriTerminalApi();

/**
 * Shadcn semantic tokens used for the xterm theme. xterm v6 resolves theme
 * colors through a canvas `fillStyle` probe, so CSS variables (`var(--…)`)
 * silently fall back to xterm defaults; literal hex keeps the theme in sync
 * with the app palette (light: --background #f5f5f5, --foreground #1a1a1a;
 * dark: #000000 / #e8e8e8) without depending on the renderer resolving vars.
 */
const TERMINAL_THEME = {
  background: "#f5f5f5",
  foreground: "#1a1a1a",
  cursor: "#1a1a1a",
  selectionBackground: "#ffffff",
};

export function TerminalCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const activeTrunkId = useProjectStore((s) => s.activeTrunkId);
  const projects = useProjectStore((s) => s.projects);
  const checkoutRuntimeByTrunkId = useProjectStore((s) => s.checkoutRuntimeByTrunkId);

  useEffect(() => {
    if (!activeTrunkId) return;

    const trunk = useProjectStore
      .getState()
      .trunks.find((t) => t.id === activeTrunkId);
    if (!trunk) return;

    const runtime = checkoutRuntimeByTrunkId[activeTrunkId];
    if (!runtime || runtime.status !== "ready") {
      return;
    }

    const project = projects.find((p) => p.id === trunk.projectId);
    const cwd = runtime.checkout.checkoutPath ?? project?.folderPath ?? "";

    useTerminalStore.getState().ensureSession(activeTrunkId);

    const entry = useTerminalStore.getState().sessionsByTrunkId[activeTrunkId];
    if (!entry || entry.status !== "idle" || !containerRef.current) return;

    useTerminalStore.getState().setSpawning(activeTrunkId);

    const terminal = new Terminal({
      scrollback: 50000,
      fontFamily: '"Space Mono", "JetBrains Mono", "SF Mono", monospace',
      fontSize: 13,
      theme: TERMINAL_THEME,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const dims = fitAddon.proposeDimensions();
    const cols = dims?.cols ?? 80;
    const rows = dims?.rows ?? 24;

    const pending = useTerminalStore.getState().drainPendingMessages(activeTrunkId);
    for (const message of pending) {
      handleMessage(terminal, message);
    }

    tauriTerminalApi
      .spawn({ cwd, cols, rows }, (message) => {
        if (!terminalRef.current) {
          useTerminalStore.getState().appendPendingMessage(activeTrunkId, message);
          return;
        }
        handleMessage(terminalRef.current, message);
      })
      .then((info) => {
        useTerminalStore.getState().setReady(activeTrunkId, info);
      })
      .catch((error) => {
        useTerminalStore.getState().setError(activeTrunkId, String(error));
      });

    const onDataDisposable = terminal.onData((data) => {
      const info = useTerminalStore.getState().sessionsByTrunkId[activeTrunkId]?.info;
      if (!info) return;
      tauriTerminalApi.write({ sessionId: info.sessionId, data }).catch(() => {});
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const newDims = fitAddon.proposeDimensions();
      const info = useTerminalStore.getState().sessionsByTrunkId[activeTrunkId]?.info;
      if (!info || !newDims) return;
      tauriTerminalApi
        .resize({ sessionId: info.sessionId, cols: newDims.cols, rows: newDims.rows })
        .catch(() => {});
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      onDataDisposable.dispose();
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      const info = useTerminalStore.getState().sessionsByTrunkId[activeTrunkId]?.info;
      if (info) {
        tauriTerminalApi.kill({ sessionId: info.sessionId }).catch(() => {});
      }
      useTerminalStore.getState().killSession(activeTrunkId);
    };
  }, [activeTrunkId, projects, checkoutRuntimeByTrunkId]);

  if (!activeTrunkId) {
    return <TerminalPlaceholder />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden p-2" />
    </div>
  );
}

function handleMessage(terminal: Terminal, message: TerminalChannelMessage) {
  if (message.kind === "Output") {
    const decoded = atob(message.payload.data);
    terminal.write(decoded);
  } else if (message.kind === "Exit") {
    const trunkId = Object.entries(useTerminalStore.getState().sessionsByTrunkId).find(
      ([, entry]) => entry.info?.sessionId === message.payload.sessionId,
    )?.[0];
    if (trunkId) {
      useTerminalStore.getState().setExited(trunkId, message.payload.exitCode);
    }
  }
}
