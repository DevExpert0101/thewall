import type { MetadataRoute } from "next";
import { getWallSummaries } from "@/lib/server";

export const dynamic = "force-dynamic";

// Index pages plus every sealed Wall's permanent record. Individual messages
// stay out of the sitemap — the archive and trending pages surface them, and
// each message still carries full social metadata when shared directly.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const walls = await getWallSummaries();

  const wallEntries: MetadataRoute.Sitemap = walls.map((w) => ({
    url: `${base}/archive/${w.id}`,
    lastModified: new Date(w.ends_at),
    changeFrequency: "never",
    priority: 0.5,
  }));

  return [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/archive`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/trending`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/rules`, changeFrequency: "yearly", priority: 0.3 },
    ...wallEntries,
  ];
}
