import { describe, expect, it } from "vitest";
import { editorLanguageFromPath } from "./editorLanguage";

describe("editorLanguageFromPath", () => {
  it.each([
    ["/proj/a.ts", "typescript"],
    ["/proj/a.tsx", "typescript"],
    ["/proj/a.js", "javascript"],
    ["/proj/a.jsx", "javascript"],
    ["C:\\proj\\a.json", "json"],
    ["readme.md", "markdown"],
    ["lib.rs", "rust"],
    ["style.css", "css"],
    ["index.html", "html"],
    ["main.py", "python"],
    ["Cargo.toml", "ini"],
    ["config.yaml", "yaml"],
    ["config.yml", "yaml"],
    ["noext", "plaintext"],
    [".hidden", "plaintext"],
  ])("maps %s to %s", (path, language) => {
    expect(editorLanguageFromPath(path)).toBe(language);
  });
});
