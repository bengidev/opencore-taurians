import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createRequire } from "node:module";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;
const require = createRequire(import.meta.url);

function resolveViteFsAllowRoots(): string[] {
  const roots = new Set<string>([path.resolve(__dirname)]);
  // Git worktrees may resolve dependencies from a parent checkout's node_modules.
  roots.add(path.dirname(path.dirname(require.resolve("vite/package.json"))));
  return [...roots];
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    fs: {
      allow: resolveViteFsAllowRoots(),
    },
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**", "**/.extract-design-system/**"],
    },
  },
}));
