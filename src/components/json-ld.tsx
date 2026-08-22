import { headers } from "next/headers";
import { siteJsonLdScript } from "@/lib/security/csp";
import type { EventSnapshot } from "@/lib/types";

/** Stable site graph. Live phase stays in Open Graph, not in this hashed script. */
export async function JsonLd({}: { event: EventSnapshot }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: siteJsonLdScript() }}
    />
  );
}
