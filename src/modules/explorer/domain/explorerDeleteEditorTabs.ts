export function matchingEditorTabIdsForDelete(
  tabIds: readonly string[],
  deletedPath: string,
  isDir: boolean,
): string[] {
  if (!isDir) {
    return tabIds.filter((id) => id === deletedPath);
  }
  const prefix = `${deletedPath}/`;
  return tabIds.filter((id) => id === deletedPath || id.startsWith(prefix));
}

export function explorerDeleteConfirmMessage(
  name: string,
  matchingTabCount: number,
): string {
  const base = `Move "${name}" to Trash?`;
  if (matchingTabCount <= 0) {
    return base;
  }
  return `${base}\n\n${matchingTabCount} open editor tab(s) will close. Unsaved changes will be discarded.`;
}
