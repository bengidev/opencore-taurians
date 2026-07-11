import { describe, expect, it } from "vitest";
import {
  projectFolderBasename,
  projectParentDirectoryPath,
} from "./projectPath";

describe("projectPath", () => {
  it("returns basename for posix and windows paths", () => {
    expect(projectFolderBasename("/Users/a/work/app")).toBe("app");
    expect(projectFolderBasename("C:\\Users\\a\\work\\app")).toBe("app");
    expect(projectFolderBasename("/Users/a/work/app/")).toBe("app");
  });

  it("returns parent directory path", () => {
    expect(projectParentDirectoryPath("/Users/a/work/app")).toBe("/Users/a/work");
    expect(projectParentDirectoryPath("C:\\Users\\a\\work\\app")).toBe(
      "C:/Users/a/work",
    );
  });
});
