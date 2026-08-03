import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../../session/infrastructure/sessionPersistStorage";
import { useShellStore } from "../../state/shellStore";
import { ShellMainPanel } from "./shellMainPanel";

describe("ShellMainPanel", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({ activeMainCard: "chat" });
  });

  it("renders terminal card inside a bordered rounded surface when active", () => {
    useShellStore.setState({ activeMainCard: "terminal" });
    const { container } = render(<ShellMainPanel />);
    // TerminalCard shows the placeholder when no trunk is active.
    const placeholder = screen.getByText(/select a project to open a terminal/i);
    // The card surface is the ancestor of the terminal content carrying the
    // rounded card classes.
    const cardSurface = container.querySelector(".rounded-md.border.border-border.bg-card");
    expect(cardSurface).not.toBeNull();
    expect(cardSurface).toContainElement(placeholder);
    expect(cardSurface).toHaveClass("bg-card", "border-border", "rounded-md");
  });
});
