import { afterEach, describe, expect, it } from "vitest";
import {
  EXPLORER_FILE_PATH_MIME,
  beginExplorerFileDrag,
  clearExplorerFileDrag,
  dataTransferHasType,
  getActiveExplorerFileDragPath,
  getExplorerFileDragPath,
  isExplorerFileDragActive,
  setExplorerFileDragData,
} from "./explorerFileDrag";

afterEach(() => {
  clearExplorerFileDrag();
});

describe("explorerFileDrag", () => {
  it("dataTransferHasType works when types is DOMStringList-like (no includes)", () => {
    const types = {
      0: EXPLORER_FILE_PATH_MIME,
      length: 1,
      contains(type: string) {
        return type === EXPLORER_FILE_PATH_MIME;
      },
      item(index: number) {
        return index === 0 ? EXPLORER_FILE_PATH_MIME : null;
      },
    };
    const dt = { types } as unknown as DataTransfer;
    expect(dataTransferHasType(dt, EXPLORER_FILE_PATH_MIME)).toBe(true);
    expect(dataTransferHasType(dt, "text/plain")).toBe(false);
  });

  it("setExplorerFileDragData begins an in-app drag session", () => {
    const store: Record<string, string> = {};
    const dt = {
      types: [EXPLORER_FILE_PATH_MIME],
      setData: (type: string, value: string) => {
        store[type] = value;
      },
      getData: (type: string) => store[type] ?? "",
    } as unknown as DataTransfer;

    setExplorerFileDragData(dt, "/proj/a.ts");
    expect(isExplorerFileDragActive()).toBe(true);
    expect(getActiveExplorerFileDragPath()).toBe("/proj/a.ts");
    expect(getExplorerFileDragPath(dt)).toBe("/proj/a.ts");
  });

  it("setExplorerFileDragData also writes text/plain so WebKit delivers dragover", () => {
    // WebKit/AppKit skips drag events when the pasteboard has only custom MIME types.
    const store: Record<string, string> = {};
    const dt = {
      types: [] as string[],
      setData: (type: string, value: string) => {
        store[type] = value;
        if (!dt.types.includes(type)) {
          dt.types.push(type);
        }
      },
      getData: (type: string) => store[type] ?? "",
    } as unknown as DataTransfer & { types: string[] };

    setExplorerFileDragData(dt, "/proj/a.ts");
    expect(store["text/plain"]).toBe("/proj/a.ts");
    expect(store[EXPLORER_FILE_PATH_MIME]).toBe("/proj/a.ts");
  });

  it("begins session before setData so a custom-MIME throw still arms the drag", () => {
    const dt = {
      types: [] as string[],
      setData: (type: string) => {
        if (type === EXPLORER_FILE_PATH_MIME) {
          throw new Error("custom mime blocked");
        }
      },
      getData: () => "",
    } as unknown as DataTransfer;

    expect(() => setExplorerFileDragData(dt, "/proj/a.ts")).not.toThrow();
    expect(isExplorerFileDragActive()).toBe(true);
    expect(getActiveExplorerFileDragPath()).toBe("/proj/a.ts");
  });

  it("getExplorerFileDragPath falls back to active session when getData is empty", () => {
    beginExplorerFileDrag("/proj/b.ts");
    const dt = {
      types: [],
      getData: () => "",
    } as unknown as DataTransfer;
    expect(getExplorerFileDragPath(dt)).toBe("/proj/b.ts");
  });
});
