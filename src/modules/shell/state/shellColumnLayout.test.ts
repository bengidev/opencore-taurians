import { describe, expect, it } from "vitest";
import { DEFAULT_SHELL_PANEL_WIDTH, MIN_SHELL_PANEL_WIDTH } from "./shellPanelSizing";
import {
  MIN_SHELL_CENTER_WIDTH,
  SHELL_LAYOUT_REFERENCE_WIDTH,
  distributeShellColumnWidths,
} from "./shellColumnLayout";

describe("distributeShellColumnWidths", () => {
  const base = {
    leftPreferred: DEFAULT_SHELL_PANEL_WIDTH,
    rightPreferred: DEFAULT_SHELL_PANEL_WIDTH,
    leftVisible: true,
    rightVisible: true,
  };

  it("keeps preferred panels above reference and gives center the rest", () => {
    const available = SHELL_LAYOUT_REFERENCE_WIDTH + 200;
    expect(distributeShellColumnWidths({ ...base, available })).toEqual({
      left: DEFAULT_SHELL_PANEL_WIDTH,
      center: available - DEFAULT_SHELL_PANEL_WIDTH * 2,
      right: DEFAULT_SHELL_PANEL_WIDTH,
    });
  });

  it("keeps preferred panels at reference width", () => {
    const available = SHELL_LAYOUT_REFERENCE_WIDTH;
    expect(distributeShellColumnWidths({ ...base, available })).toEqual({
      left: DEFAULT_SHELL_PANEL_WIDTH,
      center: available - DEFAULT_SHELL_PANEL_WIDTH * 2,
      right: DEFAULT_SHELL_PANEL_WIDTH,
    });
  });

  it("scales left and right proportionally below reference", () => {
    const available = 1000;
    const scale = available / SHELL_LAYOUT_REFERENCE_WIDTH;
    const left = Math.round(DEFAULT_SHELL_PANEL_WIDTH * scale);
    const right = Math.round(DEFAULT_SHELL_PANEL_WIDTH * scale);
    expect(distributeShellColumnWidths({ ...base, available })).toEqual({
      left,
      center: available - left - right,
      right,
    });
  });

  it("ignores hidden panels in the sum", () => {
    const available = 1000;
    const scale = available / SHELL_LAYOUT_REFERENCE_WIDTH;
    const left = Math.round(DEFAULT_SHELL_PANEL_WIDTH * scale);
    expect(
      distributeShellColumnWidths({
        ...base,
        available,
        rightVisible: false,
      }),
    ).toEqual({
      left,
      center: available - left,
      right: 0,
    });
  });

  it("returns only center when both panels are hidden", () => {
    expect(
      distributeShellColumnWidths({
        ...base,
        available: 800,
        leftVisible: false,
        rightVisible: false,
      }),
    ).toEqual({ left: 0, center: 800, right: 0 });
  });

  it("clamps to floors when available is extremely small", () => {
    const result = distributeShellColumnWidths({
      ...base,
      available: 200,
    });
    expect(result.left).toBeGreaterThanOrEqual(MIN_SHELL_PANEL_WIDTH);
    expect(result.right).toBeGreaterThanOrEqual(MIN_SHELL_PANEL_WIDTH);
    expect(result.center).toBeGreaterThanOrEqual(MIN_SHELL_CENTER_WIDTH);
  });
});
