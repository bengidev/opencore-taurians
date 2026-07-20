import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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

  it("animates outer width only while closing", () => {
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
});
