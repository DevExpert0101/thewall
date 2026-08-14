import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { publicErrorPayload } from "@/lib/errors";

const CLIENT_FILES = [
  "src/components/admin/dashboard.tsx",
  "src/components/admin/login-form.tsx",
  "src/components/admin/confirm-dialog.tsx",
];

describe("admin surface security", () => {
  it("keeps operator UI free of server secrets and the service-role client", () => {
    for (const file of CLIENT_FILES) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toMatch(/createServiceSupabase|requireServerEnv|SUPABASE_SERVICE_ROLE_KEY|TURNSTILE_SECRET_KEY|server-only/);
      expect(src).not.toMatch(/ADMIN_EMAILS/);
    }
  });

  it("disallows crawlers from /admin", () => {
    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    expect(list.some((rule) => JSON.stringify(rule.disallow).includes("/admin"))).toBe(true);
  });

  it("does not leak raw exception text that might contain secrets", () => {
    const payload = publicErrorPayload(
      new Error("SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb"),
    );
    const text = JSON.stringify(payload);
    expect(text).not.toContain("SERVICE_ROLE");
    expect(text).not.toContain("eyJ");
    expect(payload.error).toBe("Something went wrong.");
  });
});
