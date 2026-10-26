import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE.url, changeFrequency: "monthly", priority: 1 },
    ...["app", "pools", "keepers", "docs"].map((p) => ({ url: `${SITE.url}/${p}`, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
