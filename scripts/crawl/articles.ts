import type { AnyBulkWriteOperation } from "mongoose";
import ArticleModel from "../../modules/Article/articleModel";
import TeamModel from "../../modules/Team/teamModel";
import { TeamMatcher } from "./teamMatcher";
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
  tagged: number; // saved articles linked to at least one team
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
      tagged: 0,
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

    // Team names/aliases change rarely: one query per run, not per article.
    const matcher = !this.opts.dryRun && todo.length > 0 ? await TeamMatcher.load() : null;

    for (const ref of todo) {
      try {
        const info = await this.source.article(ref);
        if (!info) {
          report.failed++;
          report.errors.push(`unparseable or missing: ${ref.url}`);
          continue;
        }
        const teams = matcher?.match(info) ?? [];
        if (teams.length) report.tagged++;
        if (!this.opts.dryRun) {
          const { external_id, ...fields } = info;
          await ArticleModel.updateOne(
            { source: this.source.name, external_id },
            { $set: { ...fields, teams } },
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

export interface BackfillReport {
  articles: number;
  tagged: number;
  marked: number; // articles given notified_at so the notifier skips them
  per_team: Record<string, number>;
}

// Re-links every stored article to teams and marks the ones never notified
// as notified. Run once before turning push on, and again after changing
// aliases; it never sends anything.
export const backfillArticleTeams = async (opts: { dryRun?: boolean } = {}): Promise<BackfillReport> => {
  const matcher = await TeamMatcher.load();
  const names = new Map(
    (await TeamModel.find({}, { name: 1 }).lean()).map((t) => [t._id.toString(), t.name] as const),
  );
  const report: BackfillReport = { articles: 0, tagged: 0, marked: 0, per_team: {} };
  const now = new Date();
  const ops: AnyBulkWriteOperation[] = [];
  const flush = async () => {
    const batch = ops.splice(0);
    if (batch.length && !opts.dryRun) await ArticleModel.bulkWrite(batch, { ordered: false });
  };

  const cursor = ArticleModel.find({}, { title: 1, tags: 1, notified_at: 1 }).lean().cursor();
  for await (const a of cursor) {
    report.articles++;
    const teams = matcher.match(a);
    if (teams.length) report.tagged++;
    for (const id of teams) {
      const name = names.get(id.toString()) ?? id.toString();
      report.per_team[name] = (report.per_team[name] ?? 0) + 1;
    }
    const $set: Record<string, unknown> = { teams };
    if (!a.notified_at) {
      $set.notified_at = now;
      report.marked++;
    }
    ops.push({ updateOne: { filter: { _id: a._id }, update: { $set } } });
    if (ops.length >= 500) await flush();
  }
  await flush();
  report.per_team = Object.fromEntries(Object.entries(report.per_team).sort((x, y) => y[1] - x[1]));
  return report;
};
