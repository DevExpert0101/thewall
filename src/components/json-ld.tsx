import { siteJsonLdScript } from "@/lib/security/csp";
import type { EventSnapshot } from "@/lib/types";

/** Stable site graph. Live phase stays in Open Graph, not in this hashed script. */
export function JsonLd(_props: { event: EventSnapshot }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: siteJsonLdScript() }}
    />
  );
}
