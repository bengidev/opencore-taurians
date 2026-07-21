import { useEffect } from "react";

/** Suppress the webview/browser context menu (Inspect Element, etc.). */
export function disableBrowserContextMenu(): () => void {
  const onContextMenu = (event: Event) => {
    event.preventDefault();
  };
  document.addEventListener("contextmenu", onContextMenu, true);
  return () => document.removeEventListener("contextmenu", onContextMenu, true);
}

export function useDisableBrowserContextMenu(): void {
  useEffect(() => disableBrowserContextMenu(), []);
}
