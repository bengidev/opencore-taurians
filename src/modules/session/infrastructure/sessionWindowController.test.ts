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
});
