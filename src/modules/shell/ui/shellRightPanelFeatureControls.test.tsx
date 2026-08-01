import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useProjectStore } from "../../project/state/projectStore";
import { useShellStore } from "../state/shellStore";
import { ShellRightPanelFeatureControls } from "./shellRightPanelFeatureControls";

describe("ShellRightPanelFeatureControls", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useShellStore.setState({ rightVisible: false, rightPanelWidth: 208 });
  });

  it("is reachable now that the release gate is enabled", () => {
    render(<ShellRightPanelFeatureControls />);
    expect(screen.getByRole("group", { name: "Right panel feature" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Files" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Source control" })).toBeInTheDocument();
  });

  it("selects Git for only the active trunk and opens the panel", async () => {
    const first = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/first",
      nowIso: "2026-07-29T00:00:00.000Z",
    });
    const second = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/second",
      nowIso: "2026-07-29T00:00:01.000Z",
    });
    const width = useShellStore.getState().rightPanelWidth;
    const user = userEvent.setup();
    render(<ShellRightPanelFeatureControls enabled />);

    expect(screen.getByRole("button", { name: "Files" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Source control" }));

    expect(
      useProjectStore.getState().trunks.find((item) => item.id === second.trunk.id)
        ?.restore.rightPanelFeature,
    ).toBe("git");
    expect(
      useProjectStore.getState().trunks.find((item) => item.id === first.trunk.id)
        ?.restore.rightPanelFeature,
    ).toBe("files");
    expect(useShellStore.getState().rightVisible).toBe(true);
    expect(useShellStore.getState().rightPanelWidth).toBe(width);
  });

  it("disables both controls without an active trunk", () => {
    render(<ShellRightPanelFeatureControls enabled />);
    expect(screen.getByRole("button", { name: "Files" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Source control" })).toBeDisabled();
  });
});
