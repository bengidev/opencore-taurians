import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useShellStore } from "../state/shellStore";
import { ShellScreen } from "./shellScreen";

describe("ShellScreen", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({
      activeMainCard: "chat",
      leftVisible: true,
      rightVisible: true,
    });
  });

  it("keeps inactive main cards mounted while swapping", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    const chatInput = screen.getByLabelText("chat-dummy-note");
    await user.type(chatInput, "kept");
    await user.click(screen.getByRole("button", { name: /terminal/i }));
    await user.click(screen.getByRole("button", { name: /chat/i }));
    expect(chatInput).toHaveValue("kept");
  });

  it("hides left and right panels independently", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    expect(screen.getByLabelText("left panel")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /toggle left/i }));
    expect(screen.queryByLabelText("left panel")).not.toBeInTheDocument();
    expect(screen.getByLabelText("right panel")).toBeInTheDocument();
  });
});
