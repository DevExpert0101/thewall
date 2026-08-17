import { ImageResponse } from "next/og";
import { colors } from "@/lib/design/tokens";
import { formatInscriptionMark, formatMonumentNumber, parseMonumentNumber } from "@/lib/monument/format";
import { loadMonumentEntry } from "@/lib/monument/store";
import { formatPublicDate } from "@/lib/utils";

export const runtime = "nodejs";
export const revalidate = 3600;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Monument entry";

type Props = { params: Promise<{ number: string }> };

export default async function Image({ params }: Props) {
  const monumentNumber = parseMonumentNumber((await params).number);
  if (!monumentNumber) {
    return new ImageResponse(<OgFrame title="THE MONUMENT" body="Entry not found." />, size);
  }
  try {
    const entry = await loadMonumentEntry(monumentNumber);
    const quote = entry.isRemoved ? entry.text : `“${entry.text}”`;
    return new ImageResponse(
      (
        <OgFrame
          kicker={formatMonumentNumber(entry.monumentNumber)}
          title={entry.themeTitle}
          body={quote}
          foot={`${formatInscriptionMark(entry.originalPublicNumber)} · ${formatPublicDate(entry.sealedAt)}`}
        />
      ),
      size,
    );
  } catch {
    return new ImageResponse(<OgFrame title="THE MONUMENT" body="Entry not found." />, size);
  }
}

function OgFrame({
  kicker = "THE MONUMENT",
  title,
  body,
  foot,
}: {
  kicker?: string;
  title: string;
  body: string;
  foot?: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: colors.void,
        color: colors.paper,
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ letterSpacing: 8, fontSize: 20, color: colors.bronze }}>{kicker}</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 36, marginBottom: 20 }}>{title}</div>
        <div style={{ fontSize: 40, lineHeight: 1.2, maxWidth: 980 }}>{body}</div>
      </div>
      <div style={{ fontSize: 20, letterSpacing: 3, color: colors.mist }}>{foot ?? "THE MONUMENT"}</div>
    </div>
  );
}
