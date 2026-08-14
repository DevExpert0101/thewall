import { TAGLINE } from "@/lib/constants";
import { eventSlug, getEventSnapshot } from "@/lib/data/event";
import { hasSupabaseConfig } from "@/lib/env";
import { siteUrl } from "@/lib/utils";

export async function GET() {
  let starts = new Date();
  let ends = new Date(Date.now() + 24 * 60 * 60 * 1000);
  try {
    if (hasSupabaseConfig()) {
      const event = await getEventSnapshot(eventSlug());
      starts = new Date(event.startsAt);
      ends = new Date(event.endsAt);
    }
  } catch {
    // fallback window
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//THE WALL//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:the-wall-${starts.toISOString()}@${new URL(siteUrl()).hostname}`,
    `DTSTAMP:${formatIcs(new Date())}`,
    `DTSTART:${formatIcs(starts)}`,
    `DTEND:${formatIcs(ends)}`,
    "SUMMARY:THE WALL",
    `DESCRIPTION:${TAGLINE}\\n${siteUrl()}`,
    `URL:${siteUrl()}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="the-wall.ics"',
    },
  });
}

function formatIcs(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
