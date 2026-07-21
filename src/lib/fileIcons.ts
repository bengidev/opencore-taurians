import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Box,
  Container,
  Database,
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
} from "lucide-react";

const SPECIAL_BASENAMES: Record<string, LucideIcon> = {
  dockerfile: Container,
  containerfile: Container,
  "docker-compose.yml": Container,
  "docker-compose.yaml": Container,
  makefile: Hammer,
  gnumakefile: Hammer,
  ".gitignore": GitBranch,
  ".gitattributes": GitBranch,
  ".gitmodules": GitBranch,
  license: Scale,
  licence: Scale,
  copying: Scale,
  "package.json": Package,
  "package-lock.json": Package,
  "pnpm-lock.yaml": Package,
  "yarn.lock": Package,
  "bun.lock": Package,
  "bun.lockb": Package,
  "cargo.toml": Box,
  "cargo.lock": Box,
  "tsconfig.json": Settings2,
  "jsconfig.json": Settings2,
  ".editorconfig": Settings2,
  readme: BookOpen,
  "readme.md": BookOpen,
};

const EXTENSION_ICONS: Record<string, LucideIcon> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  mjs: FileCode,
  cjs: FileCode,
  rs: FileCode,
  py: FileCode,
  go: FileCode,
  java: FileCode,
  c: FileCode,
  cpp: FileCode,
  h: FileCode,
  cs: FileCode,
  php: FileCode,
  rb: FileCode,
  swift: FileCode,
  kt: FileCode,
  html: FileCode,
  htm: FileCode,
  xml: FileCode,
  json: FileJson,
  jsonc: FileJson,
  md: FileText,
  mdx: FileText,
  txt: FileText,
  rst: FileText,
  css: Palette,
  scss: Palette,
  sass: Palette,
  less: Palette,
  svg: Image,
  png: Image,
  jpg: Image,
  jpeg: Image,
  gif: Image,
  webp: Image,
  ico: Image,
  bmp: Image,
  yml: Settings,
  yaml: Settings,
  toml: Settings,
  ini: Settings,
  cfg: Settings,
  conf: Settings,
  sh: Terminal,
  bash: Terminal,
  zsh: Terminal,
  fish: Terminal,
  ps1: Terminal,
  bat: Terminal,
  cmd: Terminal,
  sql: Database,
  zip: FileArchive,
  tar: FileArchive,
  gz: FileArchive,
  "7z": FileArchive,
  rar: FileArchive,
  lock: Lock,
};

function isEnvFile(lowerName: string): boolean {
  return lowerName === ".env" || lowerName.startsWith(".env.");
}

export function getFileIcon(fileName: string): LucideIcon {
  const lowerName = fileName.toLowerCase();

  if (isEnvFile(lowerName)) {
    return KeyRound;
  }

  const special = SPECIAL_BASENAMES[lowerName];
  if (special) {
    return special;
  }

  const dot = lowerName.lastIndexOf(".");
  if (dot > 0 && dot < lowerName.length - 1) {
    const ext = lowerName.slice(dot + 1);
    const byExt = EXTENSION_ICONS[ext];
    if (byExt) {
      return byExt;
    }
  }

  return File;
}
