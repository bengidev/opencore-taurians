import { describe, expect, it } from "vitest";
import {
  ONBOARDING_WINDOW_SIZE,
  SHELL_WINDOW_SIZE,
  createMemoryWindowController,
} from "./sessionWindowController";

describe("createMemoryWindowController", () => {
  it("records resize and center for onboarding size", async () => {
    const controller = createMemoryWindowController();
    await controller.applyOnboardingSize();
    expect(controller.lastSize).toEqual(ONBOARDING_WINDOW_SIZE);
    expect(controller.centerCount).toBe(1);
  });

  it("records resize and center for shell size", async () => {
    const controller = createMemoryWindowController();
    await controller.applyShellSize();
    expect(controller.lastSize).toEqual(SHELL_WINDOW_SIZE);
    expect(controller.centerCount).toBe(1);
  });

  it("applies scaled shell size", async () => {
    const controller = createMemoryWindowController();
    await controller.applyShellSize(1.5);
    expect(controller.lastSize).toEqual({ width: 1920, height: 1200 });
  });

  it("clamps scaled size to injected work area", async () => {
    const controller = createMemoryWindowController({
      workArea: { width: 1400, height: 900 },
    });
    await controller.applyShellSize(2);
    expect(controller.lastSize).toEqual({ width: 1400, height: 900 });
  });
});
