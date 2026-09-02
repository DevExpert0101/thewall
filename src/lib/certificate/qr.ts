import { encode } from "uqr";
import { publicCertificatePath } from "@/lib/certificate/public";
import { siteUrl } from "@/lib/utils";

const QUIET_ZONE = 2;

/** High-contrast marks so a camera can read the code on any theme. */
export const CERTIFICATE_QR_GROUND = "#f4efe6";
export const CERTIFICATE_QR_MARK = "#090807";

export function publicCertificateUrl(publicNumber: number, origin = siteUrl()): string {
  return `${origin.replace(/\/$/, "")}${publicCertificatePath(publicNumber)}`;
}

export function encodeCertificateQr(publicNumber: number, origin = siteUrl()) {
  const url = publicCertificateUrl(publicNumber, origin);
  const expected = publicCertificatePath(publicNumber);
  if (!url.endsWith(expected) || (url.includes("/certificate/") && !url.includes("/message/"))) {
    throw new Error("QR target must be the public certificate URL.");
  }
  const { data, size } = encode(url, { ecc: "M" });
  return {
    url,
    data,
    size,
    quietZone: QUIET_ZONE,
    viewBox: size + QUIET_ZONE * 2,
  };
}

export function certificateQrPath(data: boolean[][], quietZone = QUIET_ZONE): string {
  let d = "";
  for (let y = 0; y < data.length; y += 1) {
    const row = data[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x += 1) {
      if (row[x]) d += `M${x + quietZone} ${y + quietZone}h1v1h-1z`;
    }
  }
  return d;
}
