import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShellPanelSlot } from "./shellPanelSlot";

function getSlot(container: HTMLElement) {
  return container.querySelector("[data-shell-panel-slot]") as HTMLElement;
}

describe("ShellPanelSlot", () => {
  afterEach(() => {
    cleanup();
  });

  it("snaps width changes while visible without a width transition", () => {
    const { container, rerender } = render(
      <ShellPanelSlot side="left" visible width={300}>
        panel
      </ShellPanelSlot>,
    );
    const slot = getSlot(container);
    expect(slot.style.transitionProperty).toBe("none");
    expect(slot.style.width).toBe("300px");

    rerender(
      <ShellPanelSlot side="left" visible width={200}>
        panel
      </ShellPanelSlot>,
    );
    expect(slot.style.transitionProperty).toBe("none");
    expect(slot.style.width).toBe("200px");
  });

  it("keeps width animation latched through reveal reset on steady-state close", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    try {
      const { container, rerender } = render(
        <ShellPanelSlot side="left" visible width={300}>
          panel
        </ShellPanelSlot>,
      );

      act(() => {});

      rerender(
        <ShellPanelSlot side="left" visible={false} width={300}>
          panel
        </ShellPanelSlot>,
      );
      const slot = getSlot(container);
      expect(slot.style.transitionProperty).toBe("width");

      rerender(
        <ShellPanelSlot side="left" visible={false} width={300}>
          panel
        </ShellPanelSlot>,
      );
      expect(slot.style.transitionProperty).toBe("width");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("animates outer width when closing", () => {
    const { container, rerender } = render(
      <ShellPanelSlot side="left" visible width={300}>
        panel
      </ShellPanelSlot>,
    );
    const slot = getSlot(container);

    rerender(
      <ShellPanelSlot side="left" visible={false} width={300}>
        panel
      </ShellPanelSlot>,
    );
    expect(slot.style.transitionProperty).toBe("width");
    expect(slot.style.width).toBe("0px");
  });

  it("animates outer width when reopening mid-close", () => {
    const { container, rerender } = render(
      <ShellPanelSlot side="left" visible width={300}>
        panel
      </ShellPanelSlot>,
    );

    rerender(
      <ShellPanelSlot side="left" visible={false} width={300}>
        panel
      </ShellPanelSlot>,
    );
    const slot = getSlot(container);
    expect(slot.style.transitionProperty).toBe("width");

    rerender(
      <ShellPanelSlot side="left" visible width={300}>
        panel
      </ShellPanelSlot>,
    );
    expect(slot.style.transitionProperty).toBe("width");
    expect(slot.style.width).toBe("300px");
  });

  it("stops animating outer width after a visibility transition settles", () => {
    const { container, rerender } = render(
      <ShellPanelSlot side="left" visible width={300}>
        panel
      </ShellPanelSlot>,
    );
    const slot = getSlot(container);

    rerender(
      <ShellPanelSlot side="left" visible={false} width={300}>
        panel
      </ShellPanelSlot>,
    );
    rerender(
      <ShellPanelSlot side="left" visible width={300}>
        panel
      </ShellPanelSlot>,
    );
    fireEvent.transitionEnd(slot, { propertyName: "width" });
    rerender(
      <ShellPanelSlot side="left" visible width={250}>
        panel
      </ShellPanelSlot>,
    );
    expect(slot.style.transitionProperty).toBe("none");
    expect(slot.style.width).toBe("250px");
  });
});
