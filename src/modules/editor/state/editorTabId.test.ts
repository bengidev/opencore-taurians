import { describe, expect, it } from "vitest";
import { isUntitledId, tabLabel } from "./editorTabId";

describe("editorTabId", () => {
  it("isUntitledId matches untitled:N", () => {
    expect(isUntitledId("untitled:1")).toBe(true);
    expect(isUntitledId("untitled:42")).toBe(true);
    expect(isUntitledId("/proj/a.ts")).toBe(false);
    expect(isUntitledId("untitled:")).toBe(false);
    expect(isUntitledId("untitled:abc")).toBe(false);
  });

  it("tabLabel returns Untitled-N or basename", () => {
    expect(tabLabel("untitled:1")).toBe("Untitled-1");
    expect(tabLabel("untitled:3")).toBe("Untitled-3");
    expect(tabLabel("/proj/a.ts")).toBe("a.ts");
    expect(tabLabel("C:\\proj\\b.txt")).toBe("b.txt");
  });
});
