import { ImageResponse } from "next/og";

export const revalidate = 86400;
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#080706",
          color: "#f4efe6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontFamily: "Georgia, serif",
        }}
      >
        W
      </div>
    ),
    { ...size },
  );
}
