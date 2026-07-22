export const EXPLORER_FILE_PATH_MIME = "application/x-explorer-file-path";

export function setExplorerFileDragData(dt: DataTransfer, path: string): void {
  dt.setData(EXPLORER_FILE_PATH_MIME, path);
}

export function getExplorerFileDragPath(dt: DataTransfer): string | null {
  const path = dt.getData(EXPLORER_FILE_PATH_MIME);
  return path || null;
}
