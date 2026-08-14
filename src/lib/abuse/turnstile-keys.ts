/** Cloudflare always-pass/always-block test keys. Forbidden in Vercel production. */
export const TURNSTILE_DUMMY = {
  sitePass: "1x00000000000000000000AA",
  siteBlock: "2x00000000000000000000AB",
  secretPass: "1x0000000000000000000000000000000AA",
  secretFail: "2x0000000000000000000000000000000AA",
} as const;
