import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export function ExplorerEmptySelectProject() {
  return (
    <Empty className="m-2 border-none p-6">
      <EmptyHeader>
        <EmptyTitle>No project selected</EmptyTitle>
        <EmptyDescription>
          Choose a project from the sidebar to browse its files.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
