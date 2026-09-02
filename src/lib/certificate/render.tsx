import { ImageResponse } from "next/og";
import {
  CERTIFICATE_QR_GROUND,
  CERTIFICATE_QR_MARK,
  certificateQrPath,
  encodeCertificateQr,
} from "@/lib/certificate/qr";
import { ARCHIVAL_REMOVAL_TEXT } from "@/lib/constants";
import { colors } from "@/lib/design/tokens";
import { formatCount, formatObjectIdentity, formatUtcTime, formatWallEdition } from "@/lib/utils";
import type { CertificatePayload } from "@/lib/types";
import { CREATIVE_SIZES, type CreativeRatio } from "@/lib/share/compose";

export const CERTIFICATE_PRINT = { width: 1600, height: 900 } as const;

export function certificateSize(ratio: CreativeRatio | "print") {
  if (ratio === "print") return CERTIFICATE_PRINT;
  return CREATIVE_SIZES[ratio];
}

export function renderCertificateImage(
  data: CertificatePayload,
  ratio: CreativeRatio | "print" = "print",
): ImageResponse {
  const size = certificateSize(ratio);
  const portrait = ratio === "9:16";
  const quoteSize = portrait ? 52 : ratio === "1:1" ? 44 : 40;
  const removed = data.text === ARCHIVAL_REMOVAL_TEXT;
  const inscription = removed ? data.text : `“${data.text}”`;
  const rank = data.finalRank ? `Final rank #${data.finalRank}` : "Rank pending finalization";
  const stats = `${rank}  ·  ${formatCount(data.reactionCount)} 🔥`;
  const qr = encodeCertificateQr(data.publicNumber);
  const qrBox = portrait ? 148 : 128;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: colors.void,
          backgroundImage:
            "radial-gradient(900px 480px at 50% 0%, rgba(198, 163, 108, 0.2), transparent 60%)",
          color: colors.paper,
          padding: portrait ? 80 : 72,
          fontFamily: "Georgia, serif",
          border: `2px solid ${colors.bronze}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", fontSize: 18, letterSpacing: 12, color: colors.bronze }}>
            PUBLIC CERTIFICATE
          </div>
          <div style={{ display: "flex", fontSize: 16, letterSpacing: 6, color: colors.ash }}>
            {data.editionNumber ? formatWallEdition(data.editionNumber) : data.eventTitle}
          </div>
          <div style={{ display: "flex", fontSize: 16, color: colors.mist }}>{data.eventDate}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              letterSpacing: 6,
              fontFamily: "ui-monospace, monospace",
              color: colors.bronze,
            }}
          >
            {formatObjectIdentity(data.publicNumber, data.editionNumber)}
          </div>
          <div style={{ display: "flex", width: 88, height: 1, background: colors.bronze }} />
          <div
            style={{
              display: "flex",
              fontSize: quoteSize,
              lineHeight: 1.15,
              maxWidth: size.width - 160,
              color: removed ? colors.ash : colors.paper,
            }}
          >
            {inscription}
          </div>
          <div style={{ display: "flex", fontSize: 22, color: colors.mist }}>{stats}</div>
          <div style={{ display: "flex", fontSize: 18, color: colors.ash }}>
            {`Published ${formatUtcTime(data.publishedAt)}`}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 16,
              letterSpacing: 4,
              color: colors.bronze,
              maxWidth: size.width - qrBox - 200,
            }}
          >
            {typeof data.totalMessages === "number"
              ? `${formatCount(data.totalMessages)} people spoke that day. This was one of them.`
              : formatObjectIdentity(data.publicNumber, data.editionNumber)}
          </div>
          <svg
            width={qrBox}
            height={qrBox}
            viewBox={`0 0 ${qr.viewBox} ${qr.viewBox}`}
            style={{ display: "flex" }}
          >
            <rect width={qr.viewBox} height={qr.viewBox} fill={CERTIFICATE_QR_GROUND} />
            <path d={certificateQrPath(qr.data, qr.quietZone)} fill={CERTIFICATE_QR_MARK} />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
