import { Plus } from "lucide-react";
import {
  createTauriFolderPicker,
  type FolderPicker,
} from "../../workspace-popup/infrastructure/workspaceFolderPicker";
import { projectOpenFolder } from "../state/projectActivation";
import { PanelToolButton } from "./panelToolButton";

export interface ProjectAddButtonProps {
  onRequestOpenProject?: () => void;
  folderPicker?: FolderPicker;
}

export async function projectRequestOpenFolder(
  options: Pick<ProjectAddButtonProps, "onRequestOpenProject" | "folderPicker"> = {},
) {
  const { onRequestOpenProject, folderPicker = createTauriFolderPicker() } = options;
  if (onRequestOpenProject) {
    onRequestOpenProject();
    return;
  }
  const path = await folderPicker.pickFolder();
  if (path === null) return;
  projectOpenFolder(path);
}

export function ProjectAddButton({
  onRequestOpenProject,
  folderPicker,
}: ProjectAddButtonProps) {
  return (
    <PanelToolButton
      label="Add project"
      onClick={() => void projectRequestOpenFolder({ onRequestOpenProject, folderPicker })}
    >
      <Plus className="size-3" aria-hidden />
    </PanelToolButton>
  );
}
