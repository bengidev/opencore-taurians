import { FolderSearch } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function ExplorerEmptySelectProject() {
  return (
    <Empty className="m-2 gap-ds-6 border-none p-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderSearch aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No project selected</EmptyTitle>
        <EmptyDescription>
          Choose a project from the sidebar to browse its files.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
