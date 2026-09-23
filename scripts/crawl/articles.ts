import ArticleModel from "../../modules/Article/articleModel";
import type { ArticleRef, ArticleSource } from "./types";

export interface ArticleSyncOptions {
  // Backfill from category listings instead of the news sitemap.
  category?: string;
  pages?: number;
  limit?: number; // cap on article pages fetched per run
  refresh?: boolean; // re-fetch articles already in the DB
  dryRun?: boolean;
  log?: (msg: string) => void;
}

export interface ArticleSyncReport {
  discovered: number;
  skipped: number; // already stored
  saved: number;
  failed: number;
  errors: string[]; // per-article failures, informational
  warnings: string[]; // systemic problems; the CLI exits non-zero on these
}

export class ArticleSyncer {
  private readonly log: (msg: string) => void;

  constructor(
    private readonly source: ArticleSource,
    private readonly opts: ArticleSyncOptions = {},
  ) {
    this.log = opts.log ?? (() => {});
  }

  private async discover(): Promise<ArticleRef[]> {
    const { category, pages = 1 } = this.opts;
    if (!category) return this.source.recentArticles();
    const refs: ArticleRef[] = [];
    for (let page = 1; page <= pages; page++) {
      const found = await this.source.categoryArticles(category, page);
      this.log(`[articles] ${category} page ${page}: ${found.length}`);
      if (found.length === 0) break;
      refs.push(...found);
    }
    return refs;
  }

  async sync(): Promise<ArticleSyncReport> {
    const report: ArticleSyncReport = {
      discovered: 0,
      skipped: 0,
      saved: 0,
      failed: 0,
      errors: [],
      warnings: [],
    };
    const seen = new Set<string>();
    const refs = (await this.discover()).filter((r) => !seen.has(r.external_id) && seen.add(r.external_id));
    report.discovered = refs.length;
    if (refs.length === 0) {
      report.warnings.push("no articles discovered (markup changed?)");
      return report;
    }

    // Articles don't change much after publishing, so only fetch new ones.
    let todo = refs;
    if (!this.opts.refresh && !this.opts.dryRun) {
      const existing = await ArticleModel.find(
        { source: this.source.name, external_id: { $in: refs.map((r) => r.external_id) } },
        { external_id: 1 },
      ).lean();
      const have = new Set(existing.map((d) => d.external_id));
      todo = refs.filter((r) => !have.has(r.external_id));
      report.skipped = refs.length - todo.length;
    }
    if (this.opts.limit !== undefined) todo = todo.slice(0, this.opts.limit);
    this.log(
      `[articles] ${refs.length} discovered, ${report.skipped} already stored, fetching ${todo.length}`,
    );

    for (const ref of todo) {
      try {
        const info = await this.source.article(ref);
        if (!info) {
          report.failed++;
          report.errors.push(`unparseable or missing: ${ref.url}`);
          continue;
        }
        if (!this.opts.dryRun) {
          const { external_id, ...fields } = info;
          await ArticleModel.updateOne(
            { source: this.source.name, external_id },
            { $set: fields },
            { upsert: true, runValidators: true, setDefaultsOnInsert: true },
          );
        }
        report.saved++;
        this.log(`[articles] ${info.published_at.toISOString()} ${info.category ?? "-"} | ${info.title}`);
      } catch (err) {
        report.failed++;
        report.errors.push(`${ref.url}: ${(err as Error).message}`);
      }
    }
    // A handful of broken pages is normal; most of them failing is not.
    if (todo.length >= 5 && report.failed > todo.length / 2)
      report.warnings.push(`${report.failed}/${todo.length} articles failed`);
    return report;
  }
}
