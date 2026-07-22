export function editorLanguageFromPath(path: string): string {
  const name = path.split(/[/\\]/).pop() ?? "";
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    rs: "rust",
    css: "css",
    html: "html",
    py: "python",
    toml: "ini",
    yaml: "yaml",
    yml: "yaml",
  };
  return map[ext] ?? "plaintext";
}
