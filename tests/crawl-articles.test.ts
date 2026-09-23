import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  articleIdFromUrl,
  parseArticlePage,
  parseCategoryPage,
  parseNewsSitemap,
} from "../scripts/crawl/sources/bongda/parsers/articles";
import { ArticleSyncer } from "../scripts/crawl/articles";
import type { ArticleInfo, ArticleRef, ArticleSource } from "../scripts/crawl/types";
import ArticleModel from "../modules/Article/articleModel";
import { api } from "./helpers";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures/bongda", name), "utf8");
const ARTICLE_URL =
  "https://bongda.com.vn/dieu-gi-giup-gjivai-zechiel-lot-mat-xanh-arsenal-va-chelsea-d848423.html";

describe("bongda article parsers", () => {
  it("extracts the id from an article url", () => {
    expect(articleIdFromUrl(ARTICLE_URL)).toBe("848423");
    expect(articleIdFromUrl("https://bongda.com.vn/tin-chuyen-nhuong")).toBeUndefined();
  });

  it("parses the news sitemap", () => {
    const refs = parseNewsSitemap(fixture("news-sitemap.xml"));
    expect(refs).toHaveLength(5);
    expect(refs[0]).toMatchObject({
      external_id: "848423",
      url: ARTICLE_URL,
      title: "Điều gì giúp Gjivai Zechiel lọt mắt xanh Arsenal và Chelsea?",
    });
    expect(refs[0].published_at?.toISOString()).toBe("2026-09-23T05:10:13.241Z");
  });

  it("parses a category listing page (all 25 cards)", () => {
    const refs = parseCategoryPage(fixture("category-page.html"));
    expect(refs).toHaveLength(25);
    expect(refs[0]).toMatchObject({ external_id: "848423", url: ARTICLE_URL });
    expect(refs[2].title).toBe("Juventus muốn đàm phán mượn Ait-Nouri từ Man City");
  });

  it("falls back to the JSON-LD ItemList when the cards are missing", () => {
    const html = fixture("category-page.html").replace(/<body>[\s\S]*<\/body>/, "<body></body>");
    const refs = parseCategoryPage(html);
    expect(refs).toHaveLength(10);
    expect(refs[0].external_id).toBe("848423");
  });

  it("parses article metadata from <head>", () => {
    const info = parseArticlePage(fixture("article.html"), { external_id: "848423", url: ARTICLE_URL })!;
    expect(info).toMatchObject({
      external_id: "848423",
      url: ARTICLE_URL,
      title: "Điều gì giúp Gjivai Zechiel lọt mắt xanh Arsenal và Chelsea?",
      summary: expect.stringMatching(/^Tiền vệ Gjivai Zechiel thi đấu lột xác/),
      category: "Tin Chuyển Nhượng",
      category_slug: "tin-chuyen-nhuong",
      tags: ["arsenal", "chelsea", "Gjivai Zechiel", "chuyển nhượng"],
      author: "Nguyễn Hoàng Vũ Anh",
    });
    expect(info.thumbnail).toMatch(/^https:\/\/media\.bongda\.com\.vn\/.+\.jpg$/);
    // 12:10:13 +07:00
    expect(info.published_at.toISOString()).toBe("2026-09-23T05:10:13.241Z");
  });

  it("returns null for a page without article metadata", () => {
    expect(parseArticlePage("<html><head></head></html>", { external_id: "1", url: "x" })).toBeNull();
  });
});

// Offline source: sitemap refs from the fixture, every article page served
// from the one saved article with its id/url swapped in.
class FakeArticleSource implements ArticleSource {
  readonly name = "bongda" as const;
  fetched: string[] = [];
  async recentArticles() {
    return parseNewsSitemap(fixture("news-sitemap.xml"));
  }
  async categoryArticles(_c: string, page: number) {
    return page === 1 ? parseCategoryPage(fixture("category-page.html")) : [];
  }
  async article(ref: ArticleRef): Promise<ArticleInfo | null> {
    this.fetched.push(ref.external_id);
    const info = parseArticlePage(fixture("article.html"), ref)!;
    return { ...info, external_id: ref.external_id, url: ref.url, title: ref.title ?? info.title };
  }
}

describe("article sync", () => {
  it("stores new articles and skips ones already stored", async () => {
    const source = new FakeArticleSource();
    const report = await new ArticleSyncer(source).sync();
    expect(report).toMatchObject({ discovered: 5, skipped: 0, saved: 5, failed: 0, warnings: [] });
    expect(await ArticleModel.countDocuments()).toBe(5);

    const again = new FakeArticleSource();
    const second = await new ArticleSyncer(again).sync();
    expect(second).toMatchObject({ discovered: 5, skipped: 5, saved: 0 });
    expect(again.fetched).toEqual([]);
    expect(await ArticleModel.countDocuments()).toBe(5);
  });

  it("backfills a category with --limit", async () => {
    const source = new FakeArticleSource();
    const report = await new ArticleSyncer(source, {
      category: "tin-chuyen-nhuong",
      pages: 3,
      limit: 10,
    }).sync();
    expect(report).toMatchObject({ discovered: 25, saved: 10 });
    expect(source.fetched).toHaveLength(10);
  });

  it("serves articles newest first and filters by category", async () => {
    await new ArticleSyncer(new FakeArticleSource()).sync();
    await ArticleModel.create({
      title: "Old",
      url: "https://bongda.com.vn/old-d1.html",
      published_at: new Date("2020-01-01"),
      category_slug: "v-league",
    });
    const res = await api.get("/api/articles?per_page=3");
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(6);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].published_at >= res.body.data[1].published_at).toBe(true);

    const vl = await api.get("/api/articles?filter[category_slug]=v-league");
    expect(vl.body.data.map((a: { title: string }) => a.title)).toEqual(["Old"]);

    const recent = await api.get("/api/articles?from=2026-01-01");
    expect(recent.body.meta.total).toBe(5);
  });
});
