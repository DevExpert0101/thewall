import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";

export const revalidate = 86400;

export default function robots(): MetadataRoute.Robots {
  const url = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/certificate", "/certificate/", "/claim", "/claim/", "/api/"],
      },
    ],
    sitemap: `${url}/sitemap.xml`,
    host: new URL(url).host,
  };
}
