"use client";

import { useEffect, useRef } from "react";
import { track, type TrackMeta } from "@/lib/analytics";

// Fires one analytics event when the page it sits on mounts. Rendered from
// server pages (landing, certificate, archive, trending).
export default function TrackView({
  event,
  meta,
}: {
  event: string;
  meta?: TrackMeta;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, meta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  return null;
}
