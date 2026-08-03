import { beforeEach, describe, expect, it } from "vitest";
import { useTerminalStore } from "./terminalStore";

describe("terminalStore", () => {
  beforeEach(() => {
    useTerminalStore.setState({ sessionsByTrunkId: {} });
  });

  it("creates a session entry on ensureSession", () => {
    useTerminalStore.getState().ensureSession("trunk-1");
    const entry = useTerminalStore.getState().sessionsByTrunkId["trunk-1"];
    expect(entry).toBeDefined();
    expect(entry.status).toBe("idle");
  });

  it("stores pending messages until drained", () => {
    useTerminalStore.getState().ensureSession("trunk-2");
    useTerminalStore
      .getState()
      .appendPendingMessage("trunk-2", { kind: "Output", payload: { data: "aGVsbG8=" } });
    const messages = useTerminalStore.getState().drainPendingMessages("trunk-2");
    expect(messages).toHaveLength(1);
    expect(useTerminalStore.getState().sessionsByTrunkId["trunk-2"].pendingMessages).toHaveLength(0);
  });

  it("caps pending message buffer", () => {
    useTerminalStore.getState().ensureSession("trunk-4");
    for (let i = 0; i < 2002; i++) {
      useTerminalStore
        .getState()
        .appendPendingMessage("trunk-4", { kind: "Output", payload: { data: "YQ==" } });
    }
    const messages = useTerminalStore.getState().drainPendingMessages("trunk-4");
    expect(messages).toHaveLength(2000);
  });

  it("transitions status to exited", () => {
    useTerminalStore.getState().ensureSession("trunk-3");
    useTerminalStore.getState().setExited("trunk-3", 1);
    expect(useTerminalStore.getState().sessionsByTrunkId["trunk-3"].status).toBe("exited");
  });

  it("buffers output before ensureSession", () => {
    useTerminalStore
      .getState()
      .appendPendingMessage("trunk-5", { kind: "Output", payload: { data: "aGVsbG8=" } });
    const entry = useTerminalStore.getState().sessionsByTrunkId["trunk-5"];
    expect(entry).toBeDefined();
    expect(entry.status).toBe("idle");
    expect(entry.error).toBeNull();
    expect(entry.pendingMessages).toHaveLength(1);
  });

  it("leaves error null when process exits with code 0", () => {
    useTerminalStore.getState().ensureSession("trunk-6");
    useTerminalStore.getState().setExited("trunk-6", 0);
    const entry = useTerminalStore.getState().sessionsByTrunkId["trunk-6"];
    expect(entry.status).toBe("exited");
    expect(entry.error).toBeNull();
  });

  it("sets error only for non-zero exit codes", () => {
    useTerminalStore.getState().ensureSession("trunk-7");
    useTerminalStore.getState().setExited("trunk-7", 1);
    const entry = useTerminalStore.getState().sessionsByTrunkId["trunk-7"];
    expect(entry.status).toBe("exited");
    expect(entry.error).toBe("Process exited with code 1");
  });

  it("removes the session entry on killSession", () => {
    useTerminalStore.getState().ensureSession("trunk-8");
    useTerminalStore.getState().killSession("trunk-8");
    expect(useTerminalStore.getState().sessionsByTrunkId["trunk-8"]).toBeUndefined();
  });
});
