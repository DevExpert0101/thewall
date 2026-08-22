import { APP_NAME, TAGLINE } from "@/lib/constants";
import { THEME_BOOT_SCRIPT } from "@/lib/design/theme";

function jsonLdUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:3000";
}

export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: APP_NAME,
    description: TAGLINE,
    url: jsonLdUrl(),
  };
}

export function siteJsonLdScript(): string {
  return serializeJsonLd(siteJsonLd());
}

export async function sha256Base64(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function pageScriptHashes(): Promise<string[]> {
  return Promise.all([sha256Base64(THEME_BOOT_SCRIPT), sha256Base64(siteJsonLdScript())]);
}

/** One-time CSP nonce. Must be unique per HTML request. */
export function createCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function contentSecurityPolicy(
  nonce: string,
  isDev = false,
  hashes: string[] = [],
): string {
  const hashSrc = hashes.map((hash) => `'sha256-${hash}'`).join(" ");
  const nonceSrc = nonce ? `'nonce-${nonce}'` : "";
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com;"
    : `script-src 'self' ${hashSrc} ${nonceSrc} 'strict-dynamic' https://challenges.cloudflare.com;`
        .replace(/\s+/g, " ")
        .replace(" ;", ";");
  const connectDev = isDev
    ? " http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*"
    : "";
  const upgrade = isDev ? "" : "upgrade-insecure-requests;";
  const header = `
    default-src 'self';
    ${scriptSrc}
    style-src 'self' 'unsafe-inline';
    style-src-attr 'unsafe-inline';
    img-src 'self' blob: data:;
    media-src 'self';
    font-src 'self';
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://mainnet.base.org https://sepolia.base.org https://*.base.org https://*.coinbase.com https://api.developer.coinbase.com https://*.walletconnect.com wss://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.org${connectDev};
    frame-src https://challenges.cloudflare.com https://*.coinbase.com;
    worker-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    ${upgrade}
  `;
  return header.replace(/\s{2,}/g, " ").trim();
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}
