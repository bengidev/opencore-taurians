import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingScreen } from "./onboardingScreen";
import { ThemeProvider } from "./onboardingThemeProvider";
import { LocalStorageThemeRepository } from "../infrastructure/onboardingThemeRepository";

vi.stubGlobal("requestAnimationFrame", () => 1);
vi.stubGlobal("cancelAnimationFrame", () => {});

Object.defineProperty(window, "devicePixelRatio", {
  configurable: true,
  value: 1,
});

HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  width: 520,
  height: 340,
  top: 0,
  left: 0,
  right: 520,
  bottom: 340,
  x: 0,
  y: 0,
  toJSON: () => ({}),
}));

HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  setTransform: vi.fn(),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

describe("OnboardingScreen", () => {
  it("invokes onEnter when the primary action is clicked", async () => {
    const onEnter = vi.fn();
    const user = userEvent.setup();

    render(
      <ThemeProvider repository={new LocalStorageThemeRepository("test-ui-theme")}>
        <OnboardingScreen onEnter={onEnter} />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Enter OpenCore" }));
    expect(onEnter).toHaveBeenCalledOnce();
  });
});
