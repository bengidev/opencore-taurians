import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionDebugResetButton } from "./sessionDebugResetButton";

describe("SessionDebugResetButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onReset after a tap without dragging", async () => {
    const onReset = vi.fn().mockResolvedValue(undefined);
    render(<SessionDebugResetButton onReset={onReset} />);
    const container = screen.getByRole("button", {
      name: /reset persisted data/i,
    }).parentElement as HTMLElement;

    fireEvent.pointerDown(container, {
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerUp(container, {
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });

    await waitFor(() => {
      expect(onReset).toHaveBeenCalledOnce();
    });
  });

  it("does not call onReset after dragging", () => {
    const onReset = vi.fn();
    render(<SessionDebugResetButton onReset={onReset} />);
    const container = screen.getByRole("button", {
      name: /reset persisted data/i,
    }).parentElement as HTMLElement;

    fireEvent.pointerDown(container, {
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(container, {
      pointerId: 1,
      clientX: 40,
      clientY: 40,
    });
    fireEvent.pointerUp(container, {
      pointerId: 1,
      clientX: 40,
      clientY: 40,
    });

    expect(onReset).not.toHaveBeenCalled();
  });
});
