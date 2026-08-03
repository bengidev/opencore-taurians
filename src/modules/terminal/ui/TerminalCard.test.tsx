import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Terminal } from "@xterm/xterm";
import { TerminalCard } from "./TerminalCard";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { useTerminalStore } from "../state/terminalStore";
import { useProjectStore } from "../../project/state/projectStore";
import { useShellStore } from "../../shell/state/shellStore";
import { TERMINAL_FONT_SIZE_DEFAULT } from "../domain/terminalFontSize";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";

const { mockTerminalApi } = vi.hoisted(() => ({
  mockTerminalApi: {
    spawn: vi.fn().mockResolvedValue({
      sessionId: "sess-1",
      shell: "/bin/sh",
      cwd: "/work",
      cols: 80,
      rows: 24,
    }),
    write: vi.fn().mockResolvedValue(undefined),
    resize: vi.fn().mockResolvedValue(undefined),
    getSize: vi.fn().mockResolvedValue({ cols: 80, rows: 24 }),
    kill: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@xterm/xterm", () => {
  class MockTerminal {
    static instances: MockTerminal[] = [];
    writes: Array<string | Uint8Array> = [];
    options: { theme?: object; fontSize?: number } = {};
    loadAddon() {}
    open() {}
    onData() {
      return { dispose: () => {} };
    }
    dispose() {
      const idx = MockTerminal.instances.indexOf(this);
      if (idx !== -1) MockTerminal.instances.splice(idx, 1);
    }
    write(data: string | Uint8Array) {
      this.writes.push(data);
    }
    constructor(options?: { theme?: object; fontSize?: number }) {
      MockTerminal.instances.push(this);
      if (options) this.options = options;
    }
  }
  return { Terminal: MockTerminal };
});

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit() {}
    proposeDimensions() {
      return { cols: 80, rows: 24 };
    }
  },
}));

vi.mock("@xterm/addon-web-links", () => ({
  WebLinksAddon: class {},
}));

vi.mock("../api/terminalApi", () => ({
  createTauriTerminalApi: () => mockTerminalApi,
}));

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}

interface MockTerminalShape {
  writes: Array<string | Uint8Array>;
  options: { theme?: object; fontSize?: number };
  dispose(): void;
}
const mockTerminalClass = vi.mocked(Terminal) as unknown as {
  new (options?: { theme?: object; fontSize?: number }): MockTerminalShape;
  instances: MockTerminalShape[];
};

function seedActiveTrunk() {
  useMemoryPersistStorage();
  useProjectStore.getState().resetProjectState();
  useTerminalStore.setState({ sessionsByTrunkId: {} });
  mockTerminalApi.spawn.mockClear();
  const { project, trunk } = useProjectStore
    .getState()
    .createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
  useProjectStore.getState().setCheckoutRuntime(trunk.id, {
    status: "ready",
    checkout: {
      kind: "project-root",
      scopeId: project.id,
      checkoutPath: "/work/app",
      checkoutIdentity: "identity",
      repositoryIdentity: null,
      savedRefName: null,
      managedByApp: false,
      normalizedRestore: {
        kind: "project-root",
        repositoryIdentity: null,
        savedRefName: null,
      },
    },
  });
  return { project, trunk };
}

describe("TerminalCard", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", RO);
    mockTerminalClass.instances = [];
    useThemeStore.getState().resetTheme();
    useShellStore.setState({ terminalFontSize: TERMINAL_FONT_SIZE_DEFAULT });
  });

  it("shows placeholder when no trunk is active", () => {
    render(<TerminalCard />);
    expect(
      screen.getByText(/Select a project to open a terminal/i),
    ).toBeInTheDocument();
  });

  it("spawns the terminal when the active trunk runtime is ready", async () => {
    seedActiveTrunk();
    render(<TerminalCard />);
    await waitFor(() => {
      expect(mockTerminalClass.instances).toHaveLength(1);
    });
    expect(mockTerminalApi.spawn).toHaveBeenCalledTimes(1);
  });

  it("decodes base64 output into UTF-8 bytes for xterm", async () => {
    const { trunk } = seedActiveTrunk();
    render(<TerminalCard />);
    await waitFor(() => {
      expect(mockTerminalClass.instances).toHaveLength(1);
    });
    const terminal = mockTerminalClass.instances[0];

    useTerminalStore.getState().setReady(trunk.id, {
      sessionId: "sess-1",
      shell: "/bin/sh",
      cwd: "/work",
      cols: 80,
      rows: 24,
    });

    // Deliver an Output channel message with UTF-8 bytes base64-encoded.
    const utf8Bytes = new TextEncoder().encode("héllo→世界\n");
    const b64 = btoa(String.fromCharCode(...utf8Bytes));
    const onMessage = mockTerminalApi.spawn.mock.calls[0]?.[1];
    expect(onMessage).toBeTypeOf("function");
    onMessage?.({ kind: "Output", payload: { data: b64 } });

    await waitFor(() => {
      expect(terminal.writes.length).toBeGreaterThan(0);
    });
    const written = terminal.writes[terminal.writes.length - 1];
    expect(written).toBeInstanceOf(Uint8Array);
    expect(Array.from(written as Uint8Array)).toEqual(Array.from(utf8Bytes));
  });

  it("marks the session exited when Exit arrives before spawn resolves", async () => {
    const { trunk } = seedActiveTrunk();
    // Keep the spawn promise pending so `entry.info` is never set: an Exit
    // that arrives in that window (e.g. a shell that crashes instantly) must
    // still transition the session out of "spawning" instead of being
    // dropped by the sessionId lookup.
    mockTerminalApi.spawn.mockReturnValueOnce(new Promise<never>(() => {}));
    render(<TerminalCard />);
    await waitFor(() => {
      expect(mockTerminalClass.instances).toHaveLength(1);
    });

    const onMessage = mockTerminalApi.spawn.mock.calls[0]?.[1];
    expect(onMessage).toBeTypeOf("function");
    onMessage?.({
      kind: "Exit",
      payload: { sessionId: "sess-1", exitCode: 1, signal: null },
    });

    const session = useTerminalStore.getState().sessionsByTrunkId[trunk.id];
    expect(session?.info).toBeNull();
    expect(session?.status).toBe("exited");
  });

  it("ignores a stale Exit from a previous session after a restart", async () => {
    const { trunk } = seedActiveTrunk();
    render(<TerminalCard />);
    await waitFor(() => {
      expect(mockTerminalClass.instances).toHaveLength(1);
    });

    // The fresh session is ready with its own sessionId.
    useTerminalStore.getState().setReady(trunk.id, {
      sessionId: "sess-1",
      shell: "/bin/sh",
      cwd: "/work",
      cols: 80,
      rows: 24,
    });

    // A late Exit from the killed previous PTY (different sessionId) must
    // not flip the fresh session out of "ready".
    const onMessage = mockTerminalApi.spawn.mock.calls[0]?.[1];
    expect(onMessage).toBeTypeOf("function");
    onMessage?.({
      kind: "Exit",
      payload: { sessionId: "sess-stale", exitCode: 1, signal: null },
    });

    const session = useTerminalStore.getState().sessionsByTrunkId[trunk.id];
    expect(session?.info?.sessionId).toBe("sess-1");
    expect(session?.status).toBe("ready");

    // An Exit for the current session still transitions it to "exited".
    onMessage?.({
      kind: "Exit",
      payload: { sessionId: "sess-1", exitCode: 0, signal: null },
    });
    expect(useTerminalStore.getState().sessionsByTrunkId[trunk.id]?.status).toBe("exited");
  });

  it("shows an error banner when spawn fails", () => {
    const { trunk } = seedActiveTrunk();
    useTerminalStore.getState().setError(trunk.id, "Spawn failed: boom");
    render(<TerminalCard />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Spawn failed: boom")).toBeInTheDocument();
  });

  it("restart button clears a dead session and respawns the terminal", async () => {
    const { trunk } = seedActiveTrunk();
    render(<TerminalCard />);
    await waitFor(() => {
      expect(mockTerminalClass.instances).toHaveLength(1);
    });

    useTerminalStore.getState().setExited(trunk.id, 1);
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /restart terminal/i }));

    // The banner clears the dead session and the effect respawns it.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockTerminalApi.spawn).toHaveBeenCalledTimes(2);
    });
    const restarted = useTerminalStore.getState().sessionsByTrunkId[trunk.id];
    expect(restarted?.status).toBe("ready");
    expect(mockTerminalClass.instances).toHaveLength(1);
  });

  it("does not respawn the terminal on unrelated project updates", async () => {
    const { project, trunk } = seedActiveTrunk();
    render(<TerminalCard />);
    await waitFor(() => {
      expect(mockTerminalClass.instances).toHaveLength(1);
    });
    const initialInstances = [...mockTerminalClass.instances];

    // Pinning / touching activity mutate `projects` / `trunks` identities.
    useProjectStore.getState().setProjectPinned(project.id, true);
    useProjectStore
      .getState()
      .touchTrunkActivity(trunk.id, "2026-07-10T00:00:01.000Z");
    useProjectStore.getState().setTrunkPinned(trunk.id, true);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockTerminalClass.instances).toEqual(initialInstances);
    expect(mockTerminalClass.instances).toHaveLength(1);
    expect(mockTerminalApi.spawn).toHaveBeenCalledTimes(1);
  });

  it("uses the light theme by default", async () => {
    seedActiveTrunk();
    render(<TerminalCard />);
    await waitFor(() => {
      expect(mockTerminalClass.instances).toHaveLength(1);
    });
    expect(mockTerminalClass.instances[0].options).toEqual(
      expect.objectContaining({
        theme: expect.objectContaining({ background: "#f5f5f5", foreground: "#1a1a1a" }),
      }),
    );
  });

  it("switches to dark theme when theme mode is dark", async () => {
    await act(() => useThemeStore.getState().setMode("dark"));
    seedActiveTrunk();
    render(<TerminalCard />);
    await waitFor(() => {
      expect(mockTerminalClass.instances).toHaveLength(1);
    });
    expect(mockTerminalClass.instances[0].options).toEqual(
      expect.objectContaining({
        theme: expect.objectContaining({ background: "#000000", foreground: "#e8e8e8" }),
      }),
    );
  });

  it("applies terminal font size from settings", async () => {
    await act(() => useShellStore.getState().setTerminalFontSize(20));
    seedActiveTrunk();
    render(<TerminalCard />);
    await waitFor(() => {
      expect(mockTerminalClass.instances).toHaveLength(1);
    });
    expect(mockTerminalClass.instances[0].options).toEqual(
      expect.objectContaining({ fontSize: 20 }),
    );
  });

  it("live-updates theme and font size on an existing terminal", async () => {
    seedActiveTrunk();
    render(<TerminalCard />);
    await waitFor(() => {
      expect(mockTerminalClass.instances).toHaveLength(1);
    });

    await act(() => useThemeStore.getState().setMode("dark"));
    await act(() => useShellStore.getState().setTerminalFontSize(18));

    const terminal = mockTerminalClass.instances[0];
    expect(terminal.options.theme).toEqual(
      expect.objectContaining({ background: "#000000", foreground: "#e8e8e8" }),
    );
    expect(terminal.options.fontSize).toBe(18);
    // The live PTY must not respawn on appearance-only changes.
    expect(mockTerminalApi.spawn).toHaveBeenCalledTimes(1);
  });
});
