"use client";

import { useRef } from "react";
import CardCanvas, { type CardCanvasHandle } from "./CardCanvas";
import ShareButtons from "./ShareButtons";
import { formatMessageNumber } from "@/lib/wall";

interface SharePanelProps {
  content: string;
  messageNumber: number;
  reactions: number;
  wallDate: string;
  cardId: string;
  /** Absolute deep link to the message on The Wall. */
  url: string;
}

export default function SharePanel({
  content,
  messageNumber,
  reactions,
  wallDate,
  cardId,
  url,
}: SharePanelProps) {
  const cardRef = useRef<CardCanvasHandle>(null);
  const number = `#${formatMessageNumber(messageNumber)}`;
  const title = `Message ${number} · The Wall`;
  const text = `I was here on The Wall — ${number} · “${content}”`;

  return (
    <div className="flex flex-col items-center gap-6">
      <CardCanvas
        ref={cardRef}
        content={content}
        messageNumber={messageNumber}
        reactions={reactions}
        wallDate={wallDate}
        cardId={cardId}
      />
      <ShareButtons
        url={url}
        title={title}
        text={text}
        onDownload={() => cardRef.current?.download()}
      />
    </div>
  );
}
