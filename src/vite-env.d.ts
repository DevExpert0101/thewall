/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string
  readonly VITE_TREASURY_ADDRESS?: string
  readonly VITE_PAYMENT_ETH?: string
  readonly VITE_TX_CONFIRMATIONS?: string
  readonly VITE_ALLOW_DEMO_CRYPTO?: string
  readonly VITE_ADMIN_KEY?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_RANKING_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
