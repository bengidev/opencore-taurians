function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function projectFolderBasename(folderPath: string): string {
  const normalized = normalizeSeparators(folderPath);
  const parts = normalized.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : normalized;
}

export function projectParentDirectoryPath(folderPath: string): string {
  const normalized = normalizeSeparators(folderPath);
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return normalized;
  // Keep Windows drive root like C:/
  const parent = normalized.slice(0, idx);
  return parent === "" ? "/" : parent;
}
