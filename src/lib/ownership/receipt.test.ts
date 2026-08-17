import { describe, expect, it } from "vitest";
import { privateReceiptText } from "@/lib/ownership/receipt";

describe("private ownership receipt", () => {
  it("contains the Wall Key and never-share language", () => {
    const body = privateReceiptText({
      wallKey: "7K9P-X4MF-82QH-K3R2",
      publicNumber: 4291,
      text: "I hope we were trying.",
    });
    expect(body).toContain("OWNERSHIP RECEIPT");
    expect(body).toContain("YOUR WALL KEY");
    expect(body).toContain("7K9P-X4MF-82QH-K3R2");
    expect(body).toContain("This private key proves that Message #004291 is yours.");
    expect(body).toContain("Keep it somewhere safe.");
    expect(body).toContain("We cannot recover it.");
    expect(body).toContain("Contains Wall Key.");
    expect(body).toContain("Never share.");
    expect(body).toContain("This is not the Certificate.");
  });
});
