import type { Types } from "mongoose";
import ArticleModel from "../../modules/Article/articleModel";
import TeamModel from "../../modules/Team/teamModel";
import UserModel from "../../modules/User/userModel";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: "default";
}

// https://docs.expo.dev/push-notifications/sending-notifications/#push-tickets
export interface PushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

// Sends one chunk (<= 100 messages); returns one ticket per message, in order.
export type PushSender = (messages: PushMessage[]) => Promise<PushTicket[]>;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK = 100; // Expo's per-request limit

export const expoPushSender =
  (accessToken?: string): PushSender =>
  async (messages) => {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as { data?: PushTicket[]; errors?: unknown } | null;
    if (!res.ok || !Array.isArray(body?.data)) {
      throw new Error(`expo push ${res.status}: ${JSON.stringify(body?.errors ?? body)}`);
    }
    return body.data;
  };

export interface NotifyOptions {
  windowHours?: number; // only articles published this recently are pushed
  dryRun?: boolean;
  now?: Date;
  log?: (msg: string) => void;
}

export interface NotifyReport {
  articles: number; // pending articles in the window
  users: number; // users with at least one matching article
  messages: number;
  sent: number;
  failed: number;
  removed_tokens: number;
  warnings: string[];
}

interface PendingArticle {
  _id: Types.ObjectId;
  title: string;
  teams: Types.ObjectId[];
  published_at: Date;
}

const listNames = (names: string[]) =>
  names.length > 3 ? `${names.slice(0, 3).join(", ")}…` : names.join(", ");

// Pushes "new articles about your favorite teams", at most one message per
// user and device per run. Runs from the crawl job (GitHub Actions), so the
// API server does no work; DB cost is a few queries per run.
export class TeamNewsNotifier {
  private readonly log: (msg: string) => void;

  constructor(
    private readonly send: PushSender,
    private readonly opts: NotifyOptions = {},
  ) {
    this.log = opts.log ?? (() => {});
  }

  async run(): Promise<NotifyReport> {
    const report: NotifyReport = {
      articles: 0,
      users: 0,
      messages: 0,
      sent: 0,
      failed: 0,
      removed_tokens: 0,
      warnings: [],
    };
    const now = this.opts.now ?? new Date();
    const since = new Date(now.getTime() - (this.opts.windowHours ?? 24) * 3_600_000);

    // `notified_at: null` also matches articles stored before this feature;
    // the window keeps those from being pushed if the backfill was skipped.
    const articles = await ArticleModel.find(
      { published_at: { $gte: since }, notified_at: null, "teams.0": { $exists: true } },
      { title: 1, teams: 1, published_at: 1 },
    )
      .sort({ published_at: -1 })
      .lean<PendingArticle[]>();
    report.articles = articles.length;
    if (!articles.length) return report;

    const teamIds = [...new Map(articles.flatMap((a) => a.teams).map((id) => [id.toString(), id])).values()];
    const [users, teams] = await Promise.all([
      UserModel.find(
        { favorite_teams: { $in: teamIds }, "push_tokens.0": { $exists: true } },
        { favorite_teams: 1, push_tokens: 1 },
      ).lean(),
      TeamModel.find({ _id: { $in: teamIds } }, { name: 1, short_name: 1 }).lean(),
    ]);
    const teamName = new Map(teams.map((t) => [t._id.toString(), t.short_name || t.name]));

    const messages: PushMessage[] = [];
    for (const user of users) {
      const favorites = new Set(user.favorite_teams.map(String));
      const mine = articles.filter((a) => a.teams.some((t) => favorites.has(t.toString())));
      if (!mine.length) continue;
      report.users++;
      const names = [
        ...new Set(mine.flatMap((a) => a.teams.map(String).filter((t) => favorites.has(t)))),
      ].map((id) => teamName.get(id) ?? "đội bóng yêu thích");
      const title =
        mine.length === 1
          ? `Tin mới về ${listNames(names)}`
          : `${mine.length} tin mới về ${listNames(names)}`;
      const data = {
        type: "team_news",
        article_id: mine[0]._id.toString(),
        count: mine.length,
      };
      for (const { token } of user.push_tokens) {
        messages.push({ to: token, title, body: mine[0].title, data, sound: "default" });
      }
    }
    report.messages = messages.length;

    if (this.opts.dryRun) {
      for (const m of messages) this.log(`[notify] ${m.to} | ${m.title} | ${m.body}`);
      return report;
    }

    const deadTokens = new Set<string>();
    let chunksFailed = 0;
    for (let i = 0; i < messages.length; i += CHUNK) {
      const chunk = messages.slice(i, i + CHUNK);
      try {
        const tickets = await this.send(chunk);
        tickets.forEach((ticket, j) => {
          if (ticket.status === "ok") return void report.sent++;
          report.failed++;
          if (ticket.details?.error === "DeviceNotRegistered") deadTokens.add(chunk[j].to);
          else this.log(`[notify] ${chunk[j].to}: ${ticket.message ?? ticket.details?.error}`);
        });
      } catch (err) {
        chunksFailed++;
        report.failed += chunk.length;
        report.warnings.push(`push chunk failed: ${(err as Error).message}`);
      }
    }

    if (deadTokens.size) {
      const tokens = [...deadTokens];
      await UserModel.updateMany(
        { "push_tokens.token": { $in: tokens } },
        { $pull: { push_tokens: { token: { $in: tokens } } } },
      );
      report.removed_tokens = tokens.length;
    }

    // Nothing got through (e.g. Expo down): leave the articles pending so the
    // next run retries them while they are still inside the window.
    const chunks = Math.ceil(messages.length / CHUNK);
    if (chunks > 0 && chunksFailed === chunks) return report;
    await ArticleModel.updateMany(
      { _id: { $in: articles.map((a) => a._id) } },
      { $set: { notified_at: now } },
    );
    return report;
  }
}
