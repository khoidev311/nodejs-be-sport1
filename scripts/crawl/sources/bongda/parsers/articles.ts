import * as cheerio from "cheerio";
import type { ArticleInfo, ArticleRef } from "../../../types";

// Article URLs end in `-d<id>.html`, e.g. /some-title-d848423.html.
export const articleIdFromUrl = (url: string): string | undefined =>
  url.match(/-d(\d+)\.html(?:$|[?#])/)?.[1];

const toDate = (value: string | undefined) => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const splitTags = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

// JSON-LD blocks sometimes carry raw newlines inside strings, which
// JSON.parse rejects. Control chars outside strings are just whitespace,
// so blanking all of them is safe.
const parseJsonLd = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      // eslint-disable-next-line no-control-regex
      return JSON.parse(raw.replace(/[\u0000-\u001f]/g, " "));
    } catch {
      return undefined;
    }
  }
};

const jsonLdNodes = ($: cheerio.CheerioAPI): Record<string, any>[] =>
  $('script[type="application/ld+json"]')
    .map((_, s) => parseJsonLd($(s).text()))
    .get()
    .flatMap((doc: any) => (Array.isArray(doc?.["@graph"]) ? doc["@graph"] : doc ? [doc] : []));

// news-sitemap.xml: the last ~2 days of articles with title, date, image.
export const parseNewsSitemap = (xml: string): ArticleRef[] => {
  const $ = cheerio.load(xml, { xml: true });
  const out: ArticleRef[] = [];
  $("url").each((_, el) => {
    const u = $(el);
    const url = u.children("loc").text().trim();
    const external_id = articleIdFromUrl(url);
    if (!external_id) return;
    out.push({
      external_id,
      url,
      title: u.find("news\\:title").text().trim() || undefined,
      published_at: toDate(u.find("news\\:publication_date").text().trim()),
    });
  });
  return out;
};

// Category listing (/tin-chuyen-nhuong?page=N): the main column is
// ul.news-list > li.card-horizontal (25 per page). Its JSON-LD ItemList
// only carries the first 10, so it is just a fallback.
export const parseCategoryPage = (html: string): ArticleRef[] => {
  const $ = cheerio.load(html);
  const cards = $("ul.news-list li.card-horizontal a.link")
    .map((_, a) => {
      const href = $(a).attr("href") ?? "";
      const url = new URL(href, "https://bongda.com.vn").toString();
      const external_id = articleIdFromUrl(url);
      const title = $(a).find(".title").text().trim() || $(a).attr("title")?.trim();
      return external_id ? { external_id, url, title: title || undefined } : null;
    })
    .get() as ArticleRef[];
  if (cards.length > 0) return cards;

  const list = jsonLdNodes($).find((n) => n["@type"] === "ItemList");
  const items: any[] = Array.isArray(list?.itemListElement) ? list.itemListElement : [];
  return items.flatMap((it) => {
    const url = typeof it?.url === "string" ? it.url : "";
    const external_id = articleIdFromUrl(url);
    return external_id ? [{ external_id, url, title: it.name || undefined }] : [];
  });
};

// Article page: everything we keep is in <head> (og:*, article:*, JSON-LD
// NewsArticle + BreadcrumbList). The body is deliberately not parsed.
export const parseArticlePage = (html: string, ref: ArticleRef): ArticleInfo | null => {
  const $ = cheerio.load(html);
  const meta = (key: string) =>
    $(`meta[property="${key}"], meta[name="${key}"]`).first().attr("content")?.trim() || undefined;
  const nodes = jsonLdNodes($);
  const news = nodes.find((n) => n["@type"] === "NewsArticle" || n["@type"] === "Article");
  const crumbs: any[] = nodes.find((n) => n["@type"] === "BreadcrumbList")?.itemListElement ?? [];
  // Position 1 is "Trang chủ"; the last crumb with a link is the category.
  const category = [...crumbs].reverse().find((c) => c?.position > 1 && typeof c.item === "string");
  const authors: any[] = Array.isArray(news?.author) ? news.author : news?.author ? [news.author] : [];

  const title = meta("og:title") || news?.headline || ref.title;
  const published_at =
    toDate(meta("article:published_time")) || toDate(news?.datePublished) || ref.published_at;
  if (!title || !published_at) return null;

  return {
    external_id: ref.external_id,
    url: meta("og:url") || ref.url,
    title,
    summary: meta("og:description") || meta("description") || news?.description || "",
    thumbnail: meta("og:image") || news?.image?.url || "",
    published_at,
    category: category?.name?.trim() || undefined,
    category_slug: category
      ? new URL(category.item).pathname.replace(/^\/+|\/+$/g, "") || undefined
      : undefined,
    tags: splitTags(meta("news_keywords") || meta("keywords")),
    author: authors.map((a) => a?.name).find(Boolean),
  };
};
