import { describe, expect, it } from "vitest";
import {
  LOCAL_ADMIN_EMAIL_DEFAULT,
  LOCAL_ADMIN_PASSWORD_DEFAULT,
  localAdminCredentialsMatch,
  localAdminEmail,
  localAdminEnabled,
} from "@/lib/admin/local";

describe("local simulation admin", () => {
  it("accepts the documented local credentials and rejects a wrong password", () => {
    expect(localAdminEnabled()).toBe(true);
    expect(localAdminEmail()).toBe(LOCAL_ADMIN_EMAIL_DEFAULT);
    expect(
      localAdminCredentialsMatch(LOCAL_ADMIN_EMAIL_DEFAULT, LOCAL_ADMIN_PASSWORD_DEFAULT),
    ).toBe(true);
    expect(localAdminCredentialsMatch(LOCAL_ADMIN_EMAIL_DEFAULT, "wrong-password")).toBe(false);
  });
});
