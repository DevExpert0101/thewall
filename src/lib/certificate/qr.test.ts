import { describe, expect, it } from "vitest";
import { encodeCertificateQr, publicCertificateUrl } from "@/lib/certificate/qr";

describe("certificate QR", () => {
  it("encodes only the public certificate URL", () => {
    const qr = encodeCertificateQr(19, "http://localhost:3000");
    expect(publicCertificateUrl(19, "http://localhost:3000")).toBe(
      "http://localhost:3000/message/19/certificate",
    );
    expect(qr.url).toBe("http://localhost:3000/message/19/certificate");
    expect(qr.size).toBeGreaterThan(20);
    expect(qr.data.some((row) => row.some(Boolean))).toBe(true);
    expect(qr.url).not.toMatch(/\/certificate\/[A-Za-z0-9]{8,}$/);
  });
});
