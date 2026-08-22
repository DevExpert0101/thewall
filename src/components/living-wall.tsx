"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FireButton } from "@/components/fire-button";
import { LIVE_FALLBACK_CANVAS, LIVE_LINE_HEIGHT, layoutLiveWall } from "@/lib/wall/surface";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import type { EventPhase } from "@/lib/event/state";

export function LivingWall({
  messages,
  phase,
  onReacted,
}: {
  messages: PublicMessage[];
  phase: EventPhase;
  event?: Pick<EventSnapshot, "phase" | "endsAt" | "serverNow" | "editionNumber">;
  onReacted?: (id: string, count: number) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [canvas, setCanvas] = useState(LIVE_FALLBACK_CANVAS);

  useEffect(() => {
    const node = stageRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      if (width < 1 || height < 1) return;
      setCanvas({ width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const layout = layoutLiveWall(messages, canvas);

  return (
    <div ref={stageRef} className="living-wall" aria-label="The Wall">
      {layout.map((item) => {
        const message = messages.find((row) => row.id === item.id);
        if (!message) return null;
        return (
          <article
            key={item.id}
            className={`living-sentence${message.isRemoved ? " is-removed" : ""}`}
            style={{
              left: item.x,
              top: item.y,
              width: item.width,
              height: item.height,
              fontSize: item.fontSize,
              lineHeight: LIVE_LINE_HEIGHT,
            }}
          >
            <Link href={`/message/${message.publicNumber}`} className="living-sentence-text">
              {message.text}
            </Link>
            <FireButton
              messageId={message.id}
              count={message.reactionCount}
              readOnly={phase !== "live"}
              disabled={phase !== "live" || message.isRemoved}
              onReacted={onReacted}
            />
          </article>
        );
      })}
    </div>
  );
}
