import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getPublicEnv } from "@/lib/env";

const PRIVATE_TABLES = [
  "payment_intents",
  "payments",
  "ownership_tokens",
  "admin_users",
  "claim_attempts",
  "claim_sessions",
  "reaction_signals",
  "monument_state",
];

describe("suite 10 — privacy and RLS regression", () => {
  it("does not expose service-role or ownership fields on the public env", () => {
    const json = JSON.stringify(getPublicEnv());
    expect(json).not.toMatch(/SERVICE_ROLE|sk_live_|token_hash|wallKey/i);
  });

  it("keeps public API routes off service-role writes to private tables", () => {
    const apiRoot = path.join(process.cwd(), "src", "app", "api");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const next = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (next.includes(`${path.sep}admin${path.sep}`)) continue;
          walk(next);
        } else if (entry.name.endsWith(".ts")) files.push(next);
      }
    };
    walk(apiRoot);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      for (const table of PRIVATE_TABLES) {
        expect(text).not.toMatch(new RegExp(`from\\(["']${table}["']\\)\\.(insert|update|delete)`));
      }
    }
  });

  it("keeps the SQL RLS regression file covering private tables", () => {
    const rls = readFileSync(path.join(process.cwd(), "supabase", "tests", "rls.sql"), "utf8");
    for (const table of [
      "payment_intents",
      "payments",
      "message_ownership",
      "message_claims",
      "admin_users",
      "moderation_actions",
      "reports",
      "reactions",
    ]) {
      expect(rls).toContain(`from public.${table}`);
    }
    expect(rls).toMatch(/EXPECT FAIL/i);
    const policies = readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "20260813120004_rls.sql"),
      "utf8",
    );
    expect(policies).toContain("alter table public.payment_intents enable row level security");
    expect(policies).toContain("alter table public.payments enable row level security");
    expect(policies).toContain("alter table public.admin_users enable row level security");
    const monument = readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "20260816190000_monument.sql"),
      "utf8",
    );
    expect(monument).toContain("alter table public.monument_state enable row level security");
    expect(monument).toContain("monument_entries_deny_write");
  });
});
