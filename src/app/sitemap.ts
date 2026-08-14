import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = siteUrl();
  return [
    { url, lastModified: new Date(), changeFrequency: "hourly", priority: 1 },
    { url: `${url}/wall`, lastModified: new Date(), changeFrequency: "always", priority: 0.9 },
    { url: `${url}/archive`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${url}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  ];
}
