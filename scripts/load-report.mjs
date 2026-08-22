import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const origin = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const viewers = Math.min(Number(process.env.TEST_LOAD_VIEWERS || 100), 1000);

if (process.env.VERCEL_ENV === "production" || process.env.THEWALL_PRODUCTION === "true") {
  console.error("Load test must not run against production.");
  process.exit(1);
}
if ((process.env.BASE_NETWORK || process.env.NEXT_PUBLIC_BASE_NETWORK) === "base") {
  console.error("Load test must not use Base mainnet.");
  process.exit(1);
}

const times = [];
let errors = 0;
const started = Date.now();
await Promise.all(
  Array.from({ length: viewers }, async () => {
    const t = Date.now();
    try {
      const res = await fetch(`${origin}/api/event`);
      if (!res.ok) errors += 1;
    } catch {
      errors += 1;
    }
    times.push(Date.now() - t);
  }),
);
times.sort((a, b) => a - b);
const report = {
  origin,
  viewers,
  errors,
  errorRate: errors / viewers,
  elapsedMs: Date.now() - started,
  p50: times[Math.floor(times.length * 0.5)] ?? null,
  p95: times[Math.floor(times.length * 0.95)] ?? null,
  max: times.at(-1) ?? null,
};
const dir = join(root, "test-results");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "load-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.errorRate > 0.05) process.exit(1);
