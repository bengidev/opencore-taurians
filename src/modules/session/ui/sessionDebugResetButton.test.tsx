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

  it("reclamps dragged position when the container shrinks", () => {
    const { container: root } = render(
      <div
        data-testid="scale-root"
        style={{ position: "relative", width: 1280, height: 800 }}
      >
        <SessionDebugResetButton onReset={vi.fn()} />
      </div>,
    );
    const bounds = root.querySelector(
      '[data-testid="scale-root"]',
    ) as HTMLElement;
    const container = screen.getByRole("button", {
      name: /reset persisted data/i,
    }).parentElement as HTMLElement;

    Object.defineProperty(container, "offsetWidth", {
      configurable: true,
      value: 180,
    });
    Object.defineProperty(container, "offsetHeight", {
      configurable: true,
      value: 32,
    });
    Object.defineProperty(container, "offsetParent", {
      configurable: true,
      get: () => bounds,
    });
    Object.defineProperty(bounds, "clientWidth", {
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(bounds, "clientHeight", {
      configurable: true,
      value: 800,
    });

    fireEvent.pointerDown(container, {
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(container, {
      pointerId: 1,
      clientX: 1200,
      clientY: 760,
    });
    fireEvent.pointerUp(container, {
      pointerId: 1,
      clientX: 1200,
      clientY: 760,
    });

    expect(Number.parseFloat(container.style.left)).toBeGreaterThan(1000);

    Object.defineProperty(bounds, "clientWidth", {
      configurable: true,
      value: 960,
    });
    Object.defineProperty(bounds, "clientHeight", {
      configurable: true,
      value: 680,
    });
    fireEvent(window, new Event("resize"));

    const left = Number.parseFloat(container.style.left);
    const top = Number.parseFloat(container.style.top);
    expect(left).toBeLessThanOrEqual(960 - 180 - 12);
    expect(left).toBeGreaterThanOrEqual(12);
    expect(top).toBeLessThanOrEqual(680 - 32 - 12);
    expect(top).toBeGreaterThanOrEqual(12);
  });
});
