import { ImageResponse } from "next/og";
import { colors } from "@/lib/design/tokens";
import { TAGLINE } from "@/lib/constants";
import type { CreativeCopy, CreativeRatio } from "@/lib/share/compose";
import { CREATIVE_SIZES } from "@/lib/share/compose";

function scale(ratio: CreativeRatio) {
  if (ratio === "9:16") {
    return { pad: 72, kicker: 22, title: 56, body: 40, foot: 20, rule: 88 };
  }
  if (ratio === "1:1") {
    return { pad: 72, kicker: 20, title: 48, body: 36, foot: 18, rule: 80 };
  }
  return { pad: 56, kicker: 18, title: 42, body: 28, foot: 16, rule: 72 };
}

export function renderCreativeImage(copy: CreativeCopy, ratio: CreativeRatio): ImageResponse {
  const size = CREATIVE_SIZES[ratio];
  const type = scale(ratio);
  const certificate = copy.kind === "certificate";

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
          backgroundImage: certificate
            ? "radial-gradient(800px 420px at 50% 0%, rgba(198, 163, 108, 0.18), transparent 58%)"
            : "radial-gradient(900px 500px at 50% 0%, rgba(200, 92, 42, 0.18), transparent 58%)",
          color: colors.paper,
          padding: type.pad,
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: type.kicker,
            letterSpacing: 10,
            color: colors.bronze,
          }}
        >
          <span>{copy.kicker}</span>
          <span style={{ fontSize: type.kicker - 2, letterSpacing: 6 }}>{TAGLINE}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: ratio === "9:16" ? 28 : 18 }}>
          <div
            style={{
              fontSize: copy.kind === "message" ? type.title + 8 : type.title,
              lineHeight: 1.05,
              letterSpacing: copy.kind === "message" || certificate ? 4 : -1,
              fontFamily: copy.kind === "message" || certificate ? "ui-monospace, monospace" : "Georgia, serif",
              color: certificate ? colors.bronze : colors.paper,
            }}
          >
            {copy.title}
          </div>
          <div
            style={{
              width: type.rule,
              height: 1,
              background: certificate ? colors.bronze : colors.ember,
            }}
          />
          <div
            style={{
              fontSize: type.body,
              lineHeight: 1.2,
              color: colors.mist,
              maxWidth: size.width - type.pad * 2,
            }}
          >
            {copy.body}
          </div>
        </div>
        <div
          style={{
            fontSize: type.foot,
            letterSpacing: 4,
            color: colors.bronze,
          }}
        >
          {copy.foot}
        </div>
      </div>
    ),
    size,
  );
}

export function fallbackMonumentImage(ratio: CreativeRatio = "1200x630"): ImageResponse {
  return renderCreativeImage(
    {
      kind: "countdown",
      kicker: "THE WALL",
      title: "THE WALL",
      body: TAGLINE,
      foot: TAGLINE,
    },
    ratio,
  );
}
