import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.env.VERCEL_ENV === "production" || process.env.THEWALL_PRODUCTION === "true") {
  console.error("QA suite must not run against production.");
  process.exit(1);
}
if ((process.env.BASE_NETWORK || process.env.NEXT_PUBLIC_BASE_NETWORK) === "base") {
  console.error("QA suite must not use Base mainnet.");
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["vitest", "run", "src/lib/testing"]);
run("node", ["scripts/verify-migrations.mjs"]);
