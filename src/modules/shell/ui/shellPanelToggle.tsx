import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { PanelToolButton } from "../../project";
import { useShellStore } from "../state/shellStore";

type ShellPanelSide = "left" | "right";

const PANEL_TOGGLE_META = {
  left: {
    hideLabel: "Hide left panel",
    showLabel: "Show left panel",
    CloseIcon: PanelLeftClose,
    OpenIcon: PanelLeftOpen,
    selectVisible: (s: ReturnType<typeof useShellStore.getState>) => s.leftVisible,
    toggle: (s: ReturnType<typeof useShellStore.getState>) => s.toggleLeft,
  },
  right: {
    hideLabel: "Hide right panel",
    showLabel: "Show right panel",
    CloseIcon: PanelRightClose,
    OpenIcon: PanelRightOpen,
    selectVisible: (s: ReturnType<typeof useShellStore.getState>) => s.rightVisible,
    toggle: (s: ReturnType<typeof useShellStore.getState>) => s.toggleRight,
  },
} as const;

export function ShellPanelToggle({ side }: { side: ShellPanelSide }) {
  const visible = useShellStore(PANEL_TOGGLE_META[side].selectVisible);
  const toggle = useShellStore((s) => PANEL_TOGGLE_META[side].toggle(s));
  const label = visible
    ? PANEL_TOGGLE_META[side].hideLabel
    : PANEL_TOGGLE_META[side].showLabel;
  const Icon = visible
    ? PANEL_TOGGLE_META[side].CloseIcon
    : PANEL_TOGGLE_META[side].OpenIcon;

  return (
    <PanelToolButton label={label} onClick={toggle}>
      <Icon className="size-3.5" />
    </PanelToolButton>
  );
}
