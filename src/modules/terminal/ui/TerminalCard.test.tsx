import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Terminal } from "@xterm/xterm";
import { TerminalCard } from "./TerminalCard";
import { useTerminalStore } from "../state/terminalStore";
import { useProjectStore } from "../../project/state/projectStore";
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
    constructor() {
      MockTerminal.instances.push(this);
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
  dispose(): void;
}
const mockTerminalClass = vi.mocked(Terminal) as unknown as {
  new (): MockTerminalShape;
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
});
