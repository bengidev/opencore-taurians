import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../../session/infrastructure/sessionPersistStorage";
import { useShellStore } from "../../state/shellStore";
import { ShellLeftPanelHeader } from "./shellLeftPanelHeader";

describe("ShellLeftPanelHeader", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({ leftVisible: true });
  });

  it("renders panel toggle and settings", () => {
    render(<ShellLeftPanelHeader />);
    expect(screen.getByRole("button", { name: /hide left panel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  });

  it("renders nothing when left panel is hidden", () => {
    useShellStore.setState({ leftVisible: false });
    const { container } = render(<ShellLeftPanelHeader />);
    expect(container).toBeEmptyDOMElement();
  });
});
