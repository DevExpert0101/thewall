import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { assertAutomatedTestSafe, classifyTestTarget } from "@/lib/testing/guard";

describe("automated test guard", () => {
  it("allows the local mock and Base Sepolia", () => {
    expect(() =>
      assertAutomatedTestSafe({
        VERCEL_ENV: "preview",
        BASE_NETWORK: "base-sepolia",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      }),
    ).not.toThrow();
    expect(
      classifyTestTarget({
        BASE_NETWORK: "base-sepolia",
        TEST_BASE_URL: "http://127.0.0.1:3000",
      }),
    ).toBe("local");
  });

  it("refuses production, mainnet, and the live origin", () => {
    expect(() => assertAutomatedTestSafe({ VERCEL_ENV: "production" })).toThrow(AppError);
    expect(() => assertAutomatedTestSafe({ BASE_NETWORK: "base" })).toThrow(AppError);
    expect(() =>
      assertAutomatedTestSafe({
        BASE_NETWORK: "base-sepolia",
        TEST_BASE_URL: "https://www.thewall.com",
      }),
    ).toThrow(AppError);
  });
});
