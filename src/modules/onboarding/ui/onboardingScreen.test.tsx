import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { OnboardingScreen } from "./onboardingScreen";
import { ThemeProvider } from "./onboardingThemeProvider";
import { useThemeStore } from "../state/onboardingThemeStore";

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

beforeEach(() => {
  useMemoryPersistStorage();
  localStorage.clear();
  useThemeStore.setState({ mode: "dark" });
});

afterEach(() => {
  cleanup();
});

function renderScreen(onEnter = vi.fn()) {
  render(
    <ThemeProvider>
      <OnboardingScreen onEnter={onEnter} />
    </ThemeProvider>,
  );
  return onEnter;
}

describe("OnboardingScreen", () => {
  it("invokes onEnter when the primary action is clicked", async () => {
    const onEnter = renderScreen();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Enter OpenCore" }));
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("invokes onEnter once when Enter is pressed outside interactive controls", () => {
    const onEnter = renderScreen();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("does not invoke onEnter when Enter is pressed on the primary action", async () => {
    const onEnter = renderScreen();
    const user = userEvent.setup();
    const enterButton = screen.getByRole("button", { name: "Enter OpenCore" });

    enterButton.focus();
    await user.keyboard("{Enter}");

    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("does not invoke onEnter when Enter is pressed on the theme toggle", async () => {
    const onEnter = renderScreen();
    const user = userEvent.setup();
    const themeToggle = screen.getByRole("button", {
      name: /switch to (light|dark) mode/i,
    });

    themeToggle.focus();
    await user.keyboard("{Enter}");

    expect(onEnter).not.toHaveBeenCalled();
  });
});
