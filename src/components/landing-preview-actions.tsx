"use client";

import Link from "next/link";
import { useState } from "react";
import { PrimaryCta } from "@/components/primary-cta";
import { PublishDialog } from "@/components/publish-dialog";
import { remainingMsFrom } from "@/lib/event/remaining";
import type { EventSnapshot } from "@/lib/types";
import { editionNumberOf } from "@/lib/utils";

export function LandingPreviewActions({ event }: { event: EventSnapshot }) {
  const [open, setOpen] = useState(false);
  const remaining = remainingMsFrom(event.endsAt, event.serverNow);
  const writable = event.phase === "live" && remaining > 0;

  return (
    <div className="mt-10 flex flex-wrap items-center gap-4">
      {writable ? (
        <PrimaryCta phase="live" onPublish={() => setOpen(true)} />
      ) : (
        <PrimaryCta phase={event.phase === "live" ? "finalizing" : event.phase} />
      )}
      <Link href="/wall" className="btn btn-line">
        Open The Wall
      </Link>
      <PublishDialog
        open={open}
        onOpenChange={setOpen}
        enabled={writable}
        endsAt={event.endsAt}
        serverNow={event.serverNow}
        editionNumber={editionNumberOf(event)}
      />
    </div>
  );
}
