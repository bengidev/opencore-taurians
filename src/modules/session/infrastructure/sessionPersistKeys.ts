/** Zustand persist `name` values — keep in sync with resetAll. */
export const SESSION_PERSIST_KEYS = {
  session: "opencore-session",
  workspace: "opencore-workspace",
  shell: "opencore-shell",
  theme: "opencore-theme",
  project: "opencore-project",
  chat: "opencore-chat",
} as const;

export type SessionPersistKey =
  (typeof SESSION_PERSIST_KEYS)[keyof typeof SESSION_PERSIST_KEYS];

/** Tauri plugin-store filename. */
export const SESSION_TAURI_STORE_FILE = "opencore-session.json";
