import type { MetadataRoute } from "next";
import { listSealedEditions } from "@/lib/data/editions";
import { listMonumentEntries } from "@/lib/monument/store";
import { editionPath, monumentPath, siteUrl } from "@/lib/utils";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = siteUrl();
  const editions = await listSealedEditions().catch(() => []);
  const monument = await listMonumentEntries().catch(() => ({ entries: [] as { monumentNumber: number; sealedAt: string }[] }));
  return [
    { url, lastModified: new Date(), changeFrequency: "hourly", priority: 1 },
    { url: `${url}/wall`, lastModified: new Date(), changeFrequency: "always", priority: 0.9 },
    { url: `${url}/watch`, lastModified: new Date(), changeFrequency: "always", priority: 0.85 },
    { url: `${url}/open`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.8 },
    { url: `${url}/wall/random`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.8 },
    { url: `${url}/archive`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${url}/monument`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${url}/records`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    { url: `${url}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${url}/how-it-works`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.45 },
    ...editions.flatMap((edition) => {
      const lastModified = edition.finalizedAt ? new Date(edition.finalizedAt) : new Date(edition.endsAt);
      const path = editionPath(edition.editionNumber);
      return [
        { url: `${url}${path}`, lastModified, changeFrequency: "yearly" as const, priority: 0.6 },
        { url: `${url}${path}/verify`, lastModified, changeFrequency: "yearly" as const, priority: 0.45 },
      ];
    }),
    ...monument.entries.map((entry) => ({
      url: `${url}${monumentPath(entry.monumentNumber)}`,
      lastModified: new Date(entry.sealedAt),
      changeFrequency: "yearly" as const,
      priority: 0.65,
    })),
  ];
}
