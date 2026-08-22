import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";
import { colors } from "@/lib/design/tokens";

export const runtime = "nodejs";
export const revalidate = 300;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "THE MONUMENT";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: colors.void,
          color: colors.paper,
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ letterSpacing: 10, fontSize: 22, color: colors.bronze }}>{BRAND.monumentWordmark}</div>
        <div style={{ marginTop: 28, fontSize: 48, lineHeight: 1.15, maxWidth: 900 }}>
          Millions may speak. One sentence from every Wall remains here.
        </div>
        <div style={{ marginTop: 36, fontSize: 22, letterSpacing: 4, color: colors.mist }}>
          YOU CANNOT BUY A PLACE HERE.
        </div>
      </div>
    ),
    size,
  );
}
