import type { MetadataRoute } from "next"

/** Статичные маршруты. Без NEXT_PUBLIC_SITE_URL возвращаем пусто —
 * выдумывать продакшен-домен нельзя. */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) return []
  const routes = ["/", "/news", "/tournaments", "/schedule", "/login", "/register"]
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" ? "weekly" : "daily",
    priority: route === "/" ? 1 : 0.7,
  }))
}
