import { describe, expect, it } from "vitest";
import { getTerminalTheme } from "./terminalTheme";

describe("getTerminalTheme", () => {
  it("returns light theme", () => {
    const theme = getTerminalTheme("light");
    expect(theme.background).toBe("#f5f5f5");
    expect(theme.foreground).toBe("#1a1a1a");
  });

  it("returns dark theme", () => {
    const theme = getTerminalTheme("dark");
    expect(theme.background).toBe("#000000");
    expect(theme.foreground).toBe("#e8e8e8");
  });
});
