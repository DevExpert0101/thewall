import type { MetadataRoute } from "next";
import { listSealedEditions } from "@/lib/data/editions";
import { editionPath, siteUrl } from "@/lib/utils";

export default async function sitemap(): MetadataRoute.Sitemap {
  const url = siteUrl();
  const editions = await listSealedEditions().catch(() => []);
  return [
    { url, lastModified: new Date(), changeFrequency: "hourly", priority: 1 },
    { url: `${url}/wall`, lastModified: new Date(), changeFrequency: "always", priority: 0.9 },
    { url: `${url}/archive`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${url}/records`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    { url: `${url}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    ...editions.map((edition) => ({
      url: `${url}${editionPath(edition.editionNumber)}`,
      lastModified: edition.finalizedAt ? new Date(edition.finalizedAt) : new Date(edition.endsAt),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
