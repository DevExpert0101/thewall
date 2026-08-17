"use client";

import { useEffect, useState } from "react";

/**
 * Project a server timestamp forward by local elapsed time.
 * A drifted device clock does not move the deadline.
 */
export function syncedNowMs(
  serverNow: string | number,
  originClient: number,
  clientNow: number,
): number {
  return new Date(serverNow).getTime() + (clientNow - originClient);
}

/**
 * Client clock offset from an authoritative server timestamp.
 * Never use this alone to authorize writes — the server still decides.
 */
export function useSyncedNow(serverNow: string): number {
  const [now, setNow] = useState(() => new Date(serverNow).getTime());

  useEffect(() => {
    const originClient = Date.now();
    const tick = () => {
      setNow(syncedNowMs(serverNow, originClient, Date.now()));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [serverNow]);

  return now;
}
