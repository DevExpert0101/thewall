export function contentSecurityPolicy(nonce: string, isDev = false): string {
  const scriptEval = isDev ? " 'unsafe-eval'" : "";
  const connectDev = isDev
    ? " http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*"
    : "";
  const header = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${scriptEval};
    style-src 'self' 'unsafe-inline' 'nonce-${nonce}';
    img-src 'self' blob: data:;
    font-src 'self';
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://mainnet.base.org https://sepolia.base.org https://*.base.org https://*.coinbase.com https://api.developer.coinbase.com https://*.walletconnect.com wss://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.org${connectDev};
    frame-src https://challenges.cloudflare.com https://*.coinbase.com;
    worker-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `;
  return header.replace(/\s{2,}/g, " ").trim();
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}
