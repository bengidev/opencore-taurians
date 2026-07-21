import { describe, expect, it } from "vitest";
import { disableBrowserContextMenu } from "./disableBrowserContextMenu";

describe("disableBrowserContextMenu", () => {
  it("prevents the default browser context menu", () => {
    const restore = disableBrowserContextMenu();
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    restore();
  });

  it("stops preventing after restore", () => {
    const restore = disableBrowserContextMenu();
    restore();
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
