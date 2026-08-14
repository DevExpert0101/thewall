import { describe, expect, it } from "vitest";
import { resolveAdminAccess } from "@/lib/admin/access";
import { AppError, ERROR_CODES } from "@/lib/errors";

describe("admin access", () => {
  it("rejects a missing identity without saying whether the mailbox exists", () => {
    expect(() =>
      resolveAdminAccess({
        authUserId: null,
        email: null,
        adminRow: null,
        allowlisted: false,
      }),
    ).toThrow(AppError);
    try {
      resolveAdminAccess({
        authUserId: "11111111-1111-1111-1111-111111111111",
        email: null,
        adminRow: null,
        allowlisted: true,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(401);
      expect((error as AppError).message).not.toMatch(/allowlist|admin_users/i);
    }
  });

  it("rejects a signed-in non-operator", () => {
    try {
      resolveAdminAccess({
        authUserId: "11111111-1111-1111-1111-111111111111",
        email: "visitor@example.com",
        adminRow: null,
        allowlisted: false,
      });
    } catch (error) {
      expect((error as AppError).code).toBe(ERROR_CODES.FORBIDDEN);
      expect((error as AppError).status).toBe(403);
    }
  });

  it("admits allowlisted and table-backed operators", () => {
    expect(
      resolveAdminAccess({
        authUserId: "11111111-1111-1111-1111-111111111111",
        email: "ops@example.com",
        adminRow: null,
        allowlisted: true,
      }).email,
    ).toBe("ops@example.com");
    expect(
      resolveAdminAccess({
        authUserId: "11111111-1111-1111-1111-111111111111",
        email: "ops@example.com",
        adminRow: {
          auth_user_id: "11111111-1111-1111-1111-111111111111",
          email: "ops@example.com",
        },
        allowlisted: false,
      }).id,
    ).toBe("11111111-1111-1111-1111-111111111111");
  });
});
