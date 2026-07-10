import { describe, expect, it } from "vitest";
import {
  clampShellPanelWidth,
  DEFAULT_SHELL_PANEL_WIDTH,
  MAX_SHELL_PANEL_WIDTH,
  MIN_SHELL_PANEL_WIDTH,
} from "./shellPanelSizing";

describe("shellPanelSizing", () => {
  it("uses the default shell panel width", () => {
    expect(DEFAULT_SHELL_PANEL_WIDTH).toBe(208);
  });

  it("clamps panel widths to the supported range", () => {
    expect(clampShellPanelWidth(80)).toBe(MIN_SHELL_PANEL_WIDTH);
    expect(clampShellPanelWidth(999)).toBe(MAX_SHELL_PANEL_WIDTH);
    expect(clampShellPanelWidth(241.6)).toBe(242);
  });
});
