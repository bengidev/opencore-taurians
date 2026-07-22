export const EXPLORER_FILE_PATH_MIME = "application/x-explorer-file-path";

/** Pixels of pointer movement before an Explorer file row becomes a drag. */
export const EXPLORER_FILE_DRAG_THRESHOLD_PX = 4;

/** In-app Explorer→Editor drag session (pointer-based; not HTML5 MIME). */
let activeExplorerFileDragPath: string | null = null;

export function beginExplorerFileDrag(path: string): void {
  activeExplorerFileDragPath = path;
}

export function clearExplorerFileDrag(): void {
  activeExplorerFileDragPath = null;
}

export function getActiveExplorerFileDragPath(): string | null {
  return activeExplorerFileDragPath;
}

export function isExplorerFileDragActive(): boolean {
  return activeExplorerFileDragPath !== null;
}

/** @deprecated HTML5 path kept for tests/compat; prefer pointer session. */
export function dataTransferHasType(
  dataTransfer: DataTransfer,
  type: string,
): boolean {
  return Array.from(dataTransfer.types as ArrayLike<string>).includes(type);
}

function safeSetData(dt: DataTransfer, type: string, value: string): void {
  try {
    dt.setData(type, value);
  } catch {
    // Some hosts reject individual MIME types.
  }
}

/** @deprecated Prefer beginExplorerFileDrag for in-app Explorer→Editor. */
export function setExplorerFileDragData(dt: DataTransfer, path: string): void {
  beginExplorerFileDrag(path);
  safeSetData(dt, "text/plain", path);
  safeSetData(dt, EXPLORER_FILE_PATH_MIME, path);
}

/** @deprecated Prefer getActiveExplorerFileDragPath for in-app drops. */
export function getExplorerFileDragPath(dt: DataTransfer): string | null {
  const custom = dt.getData(EXPLORER_FILE_PATH_MIME);
  if (custom) {
    return custom;
  }
  if (activeExplorerFileDragPath) {
    return activeExplorerFileDragPath;
  }
  const plain = dt.getData("text/plain");
  return plain || null;
}
