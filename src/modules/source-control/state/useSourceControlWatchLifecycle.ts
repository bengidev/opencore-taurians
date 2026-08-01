import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ResolvedSourceControlCheckout } from "../api/sourceControlContracts";
import type { WatchChangeEvent } from "../../explorer/api/explorerApi";
import { useSourceControlStore } from "./sourceControlStore";

export type { WatchChangeEvent };

function sourceControlWatchIdentity(scopeId: string): string {
  return `source-control:${scopeId}`;
}

export function useSourceControlWatchLifecycle(
  trunkId: string | null,
  checkout: ResolvedSourceControlCheckout | null,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!trunkId || !checkout) return;

    const identity = sourceControlWatchIdentity(checkout.scopeId);
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    void (async () => {
      try {
        await invoke("watch_subscribe", {
          input: {
            scopeId: checkout.scopeId,
            mode: "live",
            identity,
          },
        });

        if (cancelled) {
          await invoke("watch_unsubscribe", {
            input: {
              scopeId: checkout.scopeId,
              identity,
            },
          });
          return;
        }

        unlisten = await listen<WatchChangeEvent>("watch://changed", (event) => {
          if (cancelled) return;
          if (event.payload.root !== checkout.checkoutPath) return;
          clearTimer();
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            void useSourceControlStore.getState().refresh(trunkId, checkout);
          }, 5000);
        });
      } catch {
        // Watch subscribe failures are non-fatal; panel remains usable without live refresh.
      }
    })();

    return () => {
      cancelled = true;
      clearTimer();
      if (unlisten) {
        unlisten();
        unlisten = null;
      }
      void invoke("watch_unsubscribe", {
        input: {
          scopeId: checkout.scopeId,
          identity,
        },
      }).catch(() => undefined);
    };
  }, [trunkId, checkout]);
}
