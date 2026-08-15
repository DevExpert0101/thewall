import { headers } from "next/headers";
import { TAGLINE } from "@/lib/constants";
import { serializeJsonLd } from "@/lib/security/csp";
import { siteUrl, wallTitle } from "@/lib/utils";
import type { EventSnapshot } from "@/lib/types";

export async function JsonLd({ event }: { event: EventSnapshot }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const data = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: wallTitle(event),
    description: TAGLINE,
    startDate: event.startsAt,
    endDate: event.endsAt,
    eventStatus:
      event.phase === "live"
        ? "https://schema.org/EventMovedOnline"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    url: siteUrl(),
    location: {
      "@type": "VirtualLocation",
      url: siteUrl(),
    },
  };

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
