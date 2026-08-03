import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

import { Button } from "../../../components/ui/button";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { useProjectStore } from "../../project/state/projectStore";
import { useShellStore } from "../../shell/state/shellStore";
import { useTerminalStore, type TerminalSessionEntry } from "../state/terminalStore";
import { createTauriTerminalApi } from "../api/terminalApi";
import type { TerminalChannelMessage } from "../api/terminalContracts";
import { TerminalPlaceholder } from "./TerminalPlaceholder";
import { getTerminalTheme } from "./terminalTheme";

const tauriTerminalApi = createTauriTerminalApi();

export function TerminalCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const mode = useThemeStore((s) => s.mode);
  const terminalFontSize = useShellStore((s) => s.terminalFontSize);
  const activeTrunkId = useProjectStore((s) => s.activeTrunkId);
  const activeRuntimeStatus = useProjectStore((s) =>
    s.activeTrunkId ? s.checkoutRuntimeByTrunkId[s.activeTrunkId]?.status : undefined,
  );
  // Respawn the terminal after the user resets a dead session from the banner.
  const [resetSignal, setResetSignal] = useState(0);
  const activeSession = useTerminalStore((s) =>
    activeTrunkId ? s.sessionsByTrunkId[activeTrunkId] : null,
  );
  const bannerEntry =
    activeSession &&
    (activeSession.status === "error" || activeSession.status === "exited")
      ? activeSession
      : null;

  useEffect(() => {
    if (!activeTrunkId) return;

    const trunk = useProjectStore
      .getState()
      .trunks.find((t) => t.id === activeTrunkId);
    if (!trunk) return;

    // Read volatile slices imperatively so unrelated project-store updates
    // (pinning, lastOpenedAt, other checkouts) never respawn the live PTY.
    const state = useProjectStore.getState();
    const runtime = state.checkoutRuntimeByTrunkId[activeTrunkId];
    if (!runtime || runtime.status !== "ready") {
      return;
    }

    const project = state.projects.find((p) => p.id === trunk.projectId);
    const cwd = runtime.checkout.checkoutPath ?? project?.folderPath ?? "";

    useTerminalStore.getState().ensureSession(activeTrunkId);

    const entry = useTerminalStore.getState().sessionsByTrunkId[activeTrunkId];
    if (!entry || entry.status !== "idle" || !containerRef.current) return;

    useTerminalStore.getState().setSpawning(activeTrunkId);

    const terminal = new Terminal({
      scrollback: 50000,
      fontFamily: '"Space Mono", "JetBrains Mono", "SF Mono", monospace',
      fontSize: terminalFontSize,
      theme: getTerminalTheme(mode),
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
      handleMessage(activeTrunkId, terminal, message);
    }

    tauriTerminalApi
      .spawn({ cwd, cols, rows }, (message) => {
        if (!terminalRef.current) {
          useTerminalStore.getState().appendPendingMessage(activeTrunkId, message);
          return;
        }
        handleMessage(activeTrunkId, terminalRef.current, message);
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
    // Deliberately NOT depending on `projects` / `checkoutRuntimeByTrunkId`
    // (their identities change on unrelated project-store updates and would
    // kill the live terminal); both are read imperatively inside the effect.
    // `activeRuntimeStatus` is the narrow signal that re-runs the effect only
    // when the active trunk's runtime readiness actually changes; `resetSignal`
    // lets the banner restart a dead session via the effect.
  }, [activeTrunkId, activeRuntimeStatus, resetSignal]);

  // Live-update the existing xterm instance when the theme mode or terminal
  // font size changes, without respawning the PTY (the main effect above
  // deliberately does not depend on these values).
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = getTerminalTheme(mode);
    }
  }, [mode]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.fontSize = terminalFontSize;
    }
  }, [terminalFontSize]);

  if (!activeTrunkId) {
    return <TerminalPlaceholder />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden p-2" />
      {bannerEntry ? (
        <TerminalSessionBanner
          entry={bannerEntry}
          onRestart={() => {
            useTerminalStore.getState().killSession(activeTrunkId);
            setResetSignal((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}

interface TerminalSessionBannerProps {
  entry: TerminalSessionEntry;
  onRestart: () => void;
}

function TerminalSessionBanner({ entry, onRestart }: TerminalSessionBannerProps) {
  const isError = entry.status === "error";
  const message =
    entry.error ??
    (isError
      ? "The terminal failed to start."
      : "The terminal session ended.");
  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-t border-border bg-muted/60 px-4 py-2"
    >
      <p className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
        {message}
      </p>
      <Button size="sm" variant="secondary" onClick={onRestart}>
        Restart terminal
      </Button>
    </div>
  );
}

function handleMessage(trunkId: string, terminal: Terminal, message: TerminalChannelMessage) {
  if (message.kind === "Output") {
    // atob yields a Latin-1 binary string, corrupting UTF-8 output; decode to
    // bytes and let xterm handle the UTF-8 decoding itself.
    const bytes = Uint8Array.from(atob(message.payload.data), (c) => c.charCodeAt(0));
    terminal.write(bytes);
  } else if (message.kind === "Exit") {
    const entry = useTerminalStore.getState().sessionsByTrunkId[trunkId];
    // If the session is already known (spawn resolved), only honor an Exit
    // whose sessionId matches, so a stale Exit from a killed previous PTY
    // (after restart / trunk re-switch) can't flip the fresh session. If
    // `info` is still null (spawn hasn't resolved yet, e.g. a shell that
    // crashes instantly), fall back to routing by the closure's trunkId —
    // the sessionId match would be impossible and the session would
    // otherwise stay stuck in "spawning" forever.
    if (!entry?.info || entry.info.sessionId === message.payload.sessionId) {
      useTerminalStore.getState().setExited(trunkId, message.payload.exitCode);
    }
  }
}
