import type { APIRoute } from "astro";
import { journal, articlePath } from "../infrastructure/server/journal";
import { siteIdentity } from "../data/repositories/siteIdentity";

const entities: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" };
const xml = (value: string) => value.replace(/[<>&"']/g, character => entities[character]);

export const GET: APIRoute = ({ url }) => {
  const items = [...journal.articles].reverse().map(article => {
    const link = xml(url.origin + articlePath(article.slug));
    return `<item><title>${xml(article.title)}</title><link>${link}</link><guid>${link}</guid>` +
      `<pubDate>${new Date(article.date).toUTCString()}</pubDate><description>${xml(article.description)}</description></item>`;
  }).join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>` +
    `<title>${xml(siteIdentity.journalTitle)}</title><link>${xml(url.origin + "/journal")}</link>` +
    `<description>${xml(siteIdentity.journalDescription)}</description>${items}</channel></rss>`,
    { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } },
  );
};
