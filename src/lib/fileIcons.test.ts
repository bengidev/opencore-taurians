import { describe, expect, it } from "vitest";
import {
  BookOpen,
  Box,
  Container,
  File,
  FileArchive,
  FileCode,
  FileJson,
  FileText,
  GitBranch,
  Hammer,
  Image,
  KeyRound,
  Lock,
  Package,
  Palette,
  Scale,
  Settings,
  Settings2,
  Terminal,
  Database,
} from "lucide-react";
import { getFileIcon } from "./fileIcons";

describe("getFileIcon", () => {
  it("maps special basenames case-insensitively", () => {
    expect(getFileIcon("Dockerfile")).toBe(Container);
    expect(getFileIcon("dockerfile")).toBe(Container);
    expect(getFileIcon("Makefile")).toBe(Hammer);
    expect(getFileIcon(".gitignore")).toBe(GitBranch);
    expect(getFileIcon("LICENSE")).toBe(Scale);
    expect(getFileIcon("package.json")).toBe(Package);
    expect(getFileIcon("Cargo.toml")).toBe(Box);
    expect(getFileIcon("tsconfig.json")).toBe(Settings2);
    expect(getFileIcon("README.md")).toBe(BookOpen);
    expect(getFileIcon("readme")).toBe(BookOpen);
  });

  it("maps .env and .env.* to KeyRound", () => {
    expect(getFileIcon(".env")).toBe(KeyRound);
    expect(getFileIcon(".env.local")).toBe(KeyRound);
    expect(getFileIcon(".env.example")).toBe(KeyRound);
  });

  it("maps by last extension", () => {
    expect(getFileIcon("a.ts")).toBe(FileCode);
    expect(getFileIcon("foo.test.tsx")).toBe(FileCode);
    expect(getFileIcon("data.JSON")).toBe(FileJson);
    expect(getFileIcon("notes.md")).toBe(FileText);
    expect(getFileIcon("app.css")).toBe(Palette);
    expect(getFileIcon("logo.svg")).toBe(Image);
    expect(getFileIcon("config.yaml")).toBe(Settings);
    expect(getFileIcon("run.sh")).toBe(Terminal);
    expect(getFileIcon("query.sql")).toBe(Database);
    expect(getFileIcon("archive.zip")).toBe(FileArchive);
    expect(getFileIcon("yarn.lock")).toBe(Package); // special basename wins
    expect(getFileIcon("other.lock")).toBe(Lock);
  });

  it("falls back to File for unknown names", () => {
    expect(getFileIcon("mystery")).toBe(File);
    expect(getFileIcon("file.unknownext")).toBe(File);
  });
});
