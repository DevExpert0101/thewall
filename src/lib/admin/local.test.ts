import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/lib/crypto";
import {
  LOCAL_ADMIN_EMAIL_DEFAULT,
  LOCAL_ADMIN_PASSWORD_DEFAULT,
  localAdminCookieValid,
  localAdminCredentialsMatch,
  localAdminEmail,
  localAdminEnabled,
  localDefaultPasswordAllowed,
  signLocalAdminCookie,
} from "@/lib/admin/local";
import { missingOperatorError } from "@/lib/auth";
import { ERROR_CODES } from "@/lib/errors";

describe("local simulation admin", () => {
  it("accepts the documented local credentials and rejects a wrong password", () => {
    expect(localAdminEnabled()).toBe(true);
    expect(localAdminEmail()).toBe(LOCAL_ADMIN_EMAIL_DEFAULT);
    expect(
      localAdminCredentialsMatch(LOCAL_ADMIN_EMAIL_DEFAULT, LOCAL_ADMIN_PASSWORD_DEFAULT),
    ).toBe(true);
    expect(localAdminCredentialsMatch(LOCAL_ADMIN_EMAIL_DEFAULT, "wrong-password")).toBe(false);
    expect(localDefaultPasswordAllowed()).toBe(true);
  });

  it("rejects a forged email-hash cookie and accepts a signed session", () => {
    expect(localAdminCookieValid(sha256Hex(LOCAL_ADMIN_EMAIL_DEFAULT))).toBe(false);
    expect(localAdminCookieValid("admin@thewall.local|1|00")).toBe(false);
    const signed = signLocalAdminCookie();
    expect(localAdminCookieValid(signed)).toBe(true);
    expect(signed).not.toBe(sha256Hex(LOCAL_ADMIN_EMAIL_DEFAULT));
    const [email, issued] = signed.split("|");
    expect(localAdminCookieValid(`${email}|${issued}|${"ab".repeat(32)}`)).toBe(false);
  });

  it("asks an unsigned local operator to sign in with 401, not 503", () => {
    const local = missingOperatorError(true);
    expect(local.status).toBe(401);
    expect(local.code).toBe(ERROR_CODES.FORBIDDEN);
    const unset = missingOperatorError(false);
    expect(unset.status).toBe(503);
    expect(unset.code).toBe(ERROR_CODES.CONFIG);
  });

  it("refuses the default password when the public origin is not loopback", () => {
    const previous = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "http://192.168.130.223:3000";
    try {
      expect(localDefaultPasswordAllowed()).toBe(false);
      expect(
        localAdminCredentialsMatch(LOCAL_ADMIN_EMAIL_DEFAULT, LOCAL_ADMIN_PASSWORD_DEFAULT),
      ).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = previous;
    }
  });
});
