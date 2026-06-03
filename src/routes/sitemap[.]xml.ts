import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://sakura-bloom-forge.lovable.app";

const ROUTES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/marketplace", changefreq: "hourly", priority: "0.9" },
  { path: "/mint", changefreq: "weekly", priority: "0.8" },
  { path: "/dex", changefreq: "weekly", priority: "0.8" },
  { path: "/dex/liquidity", changefreq: "weekly", priority: "0.6" },
  { path: "/activity", changefreq: "hourly", priority: "0.7" },
  { path: "/docs", changefreq: "weekly", priority: "0.7" },
  { path: "/analytics", changefreq: "daily", priority: "0.5" },
  { path: "/leaderboard", changefreq: "daily", priority: "0.5" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = ROUTES.map(
          (e) =>
            `  <url>\n    <loc>${BASE_URL}${e.path}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
        );
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
