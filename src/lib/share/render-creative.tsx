import { ImageResponse } from "next/og";
import { colors } from "@/lib/design/tokens";
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

function quoteSize(text: string, ratio: CreativeRatio): number {
  const len = text.length;
  if (ratio === "9:16") {
    if (len > 110) return 40;
    if (len > 70) return 48;
    return 56;
  }
  if (ratio === "1:1") {
    if (len > 110) return 32;
    if (len > 70) return 38;
    return 44;
  }
  if (len > 110) return 24;
  if (len > 70) return 28;
  return 32;
}

function liveClock(copy: CreativeCopy): boolean {
  return Boolean(copy.clock?.endsWith(" REMAINING"));
}

function renderMessageCard(copy: CreativeCopy, ratio: CreativeRatio): ImageResponse {
  const size = CREATIVE_SIZES[ratio];
  const portrait = ratio === "9:16";
  const square = ratio === "1:1";
  const brand = copy.brand ?? "THE WALL";
  const edition = copy.edition ?? "";
  const status = copy.status ?? "";
  const clock = copy.clock ?? copy.foot;
  const reactions = copy.reactions ?? "";
  const ember = liveClock(copy);
  const padTop = portrait ? 160 : square ? 72 : 48;
  const padBottom = portrait ? 220 : square ? 72 : 48;
  const padX = portrait || square ? 72 : 56;
  const quote = quoteSize(copy.body, ratio);

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
            "radial-gradient(920px 520px at 50% 0%, rgba(200, 92, 42, 0.2), transparent 58%)",
          color: colors.paper,
          paddingTop: padTop,
          paddingBottom: padBottom,
          paddingLeft: padX,
          paddingRight: padX,
          fontFamily: "Georgia, serif",
          border: `2px solid ${colors.bronze}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: portrait ? 22 : 18,
            letterSpacing: 10,
            color: colors.bronze,
          }}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <span>{brand}</span>
            {edition ? <span style={{ color: colors.ash, letterSpacing: 6 }}>{edition}</span> : null}
          </div>
          <span style={{ fontSize: portrait ? 20 : 16, letterSpacing: 8, color: ember ? colors.ember : colors.bronze }}>
            {status}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: square || portrait ? "column" : "row",
            flex: 1,
            alignItems: square || portrait ? "flex-start" : "center",
            justifyContent: "center",
            gap: portrait ? 36 : 28,
            marginTop: portrait ? 48 : 20,
            marginBottom: portrait ? 48 : 16,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: square || portrait ? "100%" : 380,
              gap: 14,
            }}
          >
            {copy.number ? (
              <div
                style={{
                  display: "flex",
                  fontSize: portrait ? 92 : square ? 72 : 54,
                  lineHeight: 0.9,
                  letterSpacing: 4,
                  color: "rgba(246, 241, 231, 0.08)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {copy.number}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                fontSize: portrait ? 28 : 22,
                letterSpacing: 6,
                fontFamily: "ui-monospace, monospace",
                color: colors.bronze,
              }}
            >
              {copy.title}
            </div>
            {reactions ? (
              <div
                style={{
                  display: "flex",
                  fontSize: portrait ? 26 : 20,
                  letterSpacing: 3,
                  color: colors.mist,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {reactions}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 18, maxWidth: size.width - padX * 2 }}>
            <div
              style={{
                display: "flex",
                width: 88,
                height: 2,
                background: ember ? colors.ember : colors.bronze,
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: quote,
                lineHeight: 1.15,
                color: colors.paper,
              }}
            >
              {copy.body}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: portrait ? 16 : 10 }}>
          <div
            style={{
              display: "flex",
              fontSize: portrait ? 36 : square ? 28 : 24,
              letterSpacing: 6,
              fontFamily: "ui-monospace, monospace",
              color: ember ? colors.ember : colors.bronze,
            }}
          >
            {clock}
          </div>
        </div>
      </div>
    ),
    size,
  );
}

export function renderCreativeImage(copy: CreativeCopy, ratio: CreativeRatio): ImageResponse {
  if (copy.kind === "message" || (copy.kind === "milestone" && copy.clock)) {
    return renderMessageCard(copy, ratio);
  }

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
          {copy.number ? (
            <span style={{ fontSize: type.kicker - 2, letterSpacing: 6, fontFamily: "ui-monospace, monospace" }}>
              {copy.number}
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: ratio === "9:16" ? 28 : 18 }}>
          <div
            style={{
              display: "flex",
              fontSize: certificate ? type.title : type.title,
              lineHeight: 1.05,
              letterSpacing: certificate ? 4 : -1,
              fontFamily: certificate ? "ui-monospace, monospace" : "Georgia, serif",
              color: certificate ? colors.bronze : colors.paper,
            }}
          >
            {copy.title}
          </div>
          <div
            style={{
              display: "flex",
              width: type.rule,
              height: 1,
              background: certificate ? colors.bronze : colors.ember,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: certificate ? type.body + 6 : type.body,
              lineHeight: 1.2,
              color: certificate ? colors.paper : colors.mist,
              maxWidth: size.width - type.pad * 2,
            }}
          >
            {copy.body}
          </div>
        </div>
        <div
          style={{
            display: "flex",
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
      body: "A sentence on the stone.",
      foot: "THE WALL",
    },
    ratio,
  );
}
