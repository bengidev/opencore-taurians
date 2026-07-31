import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ResolvedSourceControlCheckout } from "../api/sourceControlContracts";
import { useSourceControlStore } from "./sourceControlStore";

export interface WatchChangeEvent {
  root: string;
  revision: number;
  kinds: string[];
}

export function useSourceControlWatchLifecycle(
  trunkId: string | null,
  checkout: ResolvedSourceControlCheckout | null,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!trunkId || !checkout) return;

    let cancelled = false;
    let unlisten: (() => void) | null = null;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    void (async () => {
      unlisten = await listen<WatchChangeEvent>("watch://changed", (event) => {
        if (cancelled) return;
        if (event.payload.root !== checkout.checkoutPath) return;
        clearTimer();
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          void useSourceControlStore.getState().refresh(trunkId, checkout);
        }, 5000);
      });
    })();

    return () => {
      cancelled = true;
      clearTimer();
      if (unlisten) {
        unlisten();
        unlisten = null;
      }
    };
  }, [trunkId, checkout]);
}
