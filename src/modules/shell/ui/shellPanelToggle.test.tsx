import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useShellStore } from "../state/shellStore";
import { ShellPanelToggle } from "./shellPanelToggle";

describe("ShellPanelToggle", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({ leftVisible: true, rightVisible: true });
  });

  it("shows hide label when left panel is open", () => {
    render(<ShellPanelToggle side="left" />);
    expect(screen.getByRole("button", { name: "Hide left panel" })).toBeInTheDocument();
  });

  it("shows show label when left panel is closed", () => {
    useShellStore.setState({ leftVisible: false });
    render(<ShellPanelToggle side="left" />);
    expect(screen.getByRole("button", { name: "Show left panel" })).toBeInTheDocument();
  });

  it("toggles right panel visibility", async () => {
    const user = userEvent.setup();
    render(<ShellPanelToggle side="right" />);
    await user.click(screen.getByRole("button", { name: "Hide right panel" }));
    expect(useShellStore.getState().rightVisible).toBe(false);
  });
});
