import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { TeamMatcher, normalizeName } from "../scripts/crawl/teamMatcher";
import { backfillArticleTeams } from "../scripts/crawl/articles";
import { TeamNewsNotifier, type PushMessage, type PushTicket } from "../scripts/crawl/notify";
import ArticleModel from "../modules/Article/articleModel";
import TeamModel from "../modules/Team/teamModel";
import UserModel from "../modules/User/userModel";
import { api, auth, seedAdmin } from "./helpers";

const team = (name: string, extra: Record<string, unknown> = {}) =>
  TeamModel.create({ name, logo: "https://x/logo.png", ...extra });

const tokenOf = (n: number) => `ExponentPushToken[device-${n}]`;

describe("team matcher", () => {
  const ids = {
    mu: new Types.ObjectId(),
    city: new Types.ObjectId(),
    cahn: new Types.ObjectId(),
    hanoi: new Types.ObjectId(),
    inter: new Types.ObjectId(),
  };
  const matcher = new TeamMatcher([
    { _id: ids.mu, name: "Manchester United" },
    { _id: ids.city, name: "Manchester City" },
    { _id: ids.cahn, name: "Cong An Ha Noi" },
    { _id: ids.hanoi, name: "Ha Noi FC", aliases: ["Hà Nội"] },
    { _id: ids.inter, name: "Inter" },
  ]);
  const match = (title: string, tags: string[] = []) => matcher.match({ title, tags }).map(String).sort();

  it("normalizes Vietnamese diacritics and punctuation", () => {
    expect(normalizeName("Công An Hà Nội")).toBe("cong an ha noi");
    expect(normalizeName("Brighton & Hove Albion")).toBe("brighton hove albion");
  });

  it("matches tags exactly, including built-in aliases", () => {
    expect(match("Tin tổng hợp", ["Man Utd", "chuyển nhượng"])).toEqual([String(ids.mu)]);
    expect(match("Tin tổng hợp", ["cahn"])).toEqual([String(ids.cahn)]);
    expect(match("Tin tổng hợp", ["MU"])).toEqual([String(ids.mu)]);
  });

  it("matches long names in titles as whole words", () => {
    expect(match("Manchester City đánh bại Manchester United")).toEqual(
      [String(ids.city), String(ids.mu)].sort(),
    );
    expect(match("Mancity fan")).toEqual([]);
  });

  it("keeps short keys out of titles", () => {
    expect(match("Chiếc mũ của HLV")).toEqual([]); // "mu"
    expect(match("Messi rời Inter Miami")).toEqual([]); // "inter"
  });

  it("prefers the longest name so a club does not match its city", () => {
    expect(match("Công An Hà Nội thắng đậm")).toEqual([String(ids.cahn)]);
    expect(match("Hà Nội FC hòa")).toEqual([String(ids.hanoi)]);
  });
});

describe("backfill", () => {
  it("links stored articles to teams and marks them notified", async () => {
    const arsenal = await team("Arsenal");
    await ArticleModel.create([
      { title: "Arsenal thắng", url: "u1", published_at: new Date(), tags: [] },
      { title: "Không liên quan", url: "u2", published_at: new Date(), tags: ["việt nam"] },
    ]);
    const dry = await backfillArticleTeams({ dryRun: true });
    expect(dry).toMatchObject({ articles: 2, tagged: 1, marked: 2, per_team: { Arsenal: 1 } });
    expect(await ArticleModel.countDocuments({ notified_at: { $exists: true } })).toBe(0);

    await backfillArticleTeams();
    const a = await ArticleModel.findOne({ url: "u1" });
    expect(a!.teams.map(String)).toEqual([String(arsenal._id)]);
    expect(await ArticleModel.countDocuments({ notified_at: null })).toBe(0);
  });
});

describe("team news notifier", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
  let sent: PushMessage[][];
  const okSender = async (msgs: PushMessage[]): Promise<PushTicket[]> => {
    sent.push(msgs);
    return msgs.map(() => ({ status: "ok", id: "t" }));
  };

  let arsenal: { _id: Types.ObjectId };
  let chelsea: { _id: Types.ObjectId };
  beforeEach(async () => {
    sent = [];
    [arsenal, chelsea] = await Promise.all([team("Arsenal"), team("Chelsea")]);
  });

  const user = (n: number, favorite_teams: Types.ObjectId[], tokens = [tokenOf(n)]) =>
    UserModel.create({
      username: `u${n}`,
      password: "x",
      fullname: "U",
      email: `u${n}@x.com`,
      favorite_teams,
      push_tokens: tokens.map((token) => ({ token })),
    });

  const article = (title: string, teams: Types.ObjectId[], published_at = hoursAgo(1), extra = {}) =>
    ArticleModel.create({ title, url: title, published_at, teams, ...extra });

  it("sends one grouped message per device and marks articles notified", async () => {
    await article("Arsenal 1", [arsenal._id], hoursAgo(2));
    await article("Arsenal 2", [arsenal._id], hoursAgo(1));
    await article("Chelsea 1", [chelsea._id]);
    await user(1, [arsenal._id], [tokenOf(1), tokenOf(11)]);
    await user(2, [chelsea._id]);
    await user(3, [arsenal._id], []); // no device: skipped

    const report = await new TeamNewsNotifier(okSender, { now }).run();
    expect(report).toMatchObject({ articles: 3, users: 2, messages: 3, sent: 3, failed: 0 });
    const byToken = Object.fromEntries(sent.flat().map((m) => [m.to, m]));
    expect(byToken[tokenOf(1)].title).toBe("2 tin mới về Arsenal");
    expect(byToken[tokenOf(1)].body).toBe("Arsenal 2"); // newest first
    expect(byToken[tokenOf(11)].title).toBe("2 tin mới về Arsenal");
    expect(byToken[tokenOf(2)]).toMatchObject({ title: "Tin mới về Chelsea", body: "Chelsea 1" });
    expect(await ArticleModel.countDocuments({ notified_at: now })).toBe(3);

    // A second run finds nothing left to send.
    sent = [];
    expect((await new TeamNewsNotifier(okSender, { now }).run()).articles).toBe(0);
    expect(sent).toEqual([]);
  });

  it("ignores old, already-notified and untagged articles", async () => {
    await article("Old", [arsenal._id], hoursAgo(30));
    await article("Done", [arsenal._id], hoursAgo(1), { notified_at: hoursAgo(1) });
    await article("Untagged", []);
    await user(1, [arsenal._id]);
    const report = await new TeamNewsNotifier(okSender, { now }).run();
    expect(report.articles).toBe(0);
    expect(sent).toEqual([]);
  });

  it("removes tokens Expo reports as unregistered", async () => {
    await article("Arsenal 1", [arsenal._id]);
    await user(1, [arsenal._id], [tokenOf(1), tokenOf(2)]);
    const sender = async (msgs: PushMessage[]): Promise<PushTicket[]> =>
      msgs.map((m) =>
        m.to === tokenOf(2)
          ? { status: "error", details: { error: "DeviceNotRegistered" } }
          : { status: "ok" },
      );
    const report = await new TeamNewsNotifier(sender, { now }).run();
    expect(report).toMatchObject({ sent: 1, failed: 1, removed_tokens: 1 });
    const u = await UserModel.findOne({ username: "u1" });
    expect(u!.push_tokens.map((t) => t.token)).toEqual([tokenOf(1)]);
  });

  it("leaves articles pending when every push request fails", async () => {
    await article("Arsenal 1", [arsenal._id]);
    await user(1, [arsenal._id]);
    const down = async (): Promise<PushTicket[]> => {
      throw new Error("503");
    };
    const report = await new TeamNewsNotifier(down, { now }).run();
    expect(report.warnings).toHaveLength(1);
    expect(await ArticleModel.countDocuments({ notified_at: null })).toBe(1);
  });

  it("does not send or write on dry run", async () => {
    await article("Arsenal 1", [arsenal._id]);
    await user(1, [arsenal._id]);
    const report = await new TeamNewsNotifier(okSender, { now, dryRun: true }).run();
    expect(report.messages).toBe(1);
    expect(sent).toEqual([]);
    expect(await ArticleModel.countDocuments({ notified_at: null })).toBe(1);
  });
});

describe("/api/me", () => {
  let token: string;
  let arsenal: { _id: Types.ObjectId };
  beforeEach(async () => {
    await seedAdmin();
    arsenal = await team("Arsenal");
    const reg = await api
      .post("/api/auth/register")
      .send({ username: "bob", password: "secret1", fullname: "Bob", email: "bob@example.com" });
    token = reg.body.access_token;
  });

  it("requires a token", async () => {
    expect((await api.get("/api/me/feed")).status).toBe(401);
  });

  it("sets favorite teams and serves a feed of their articles", async () => {
    const empty = await api.get("/api/me/feed").set(auth(token));
    expect(empty.body).toMatchObject({ data: [], meta: { total: 0 } });

    const bad = await api
      .put("/api/me/favorite-teams")
      .set(auth(token))
      .send({ teams: [String(new Types.ObjectId())] });
    expect(bad.status).toBe(400);

    const put = await api
      .put("/api/me/favorite-teams")
      .set(auth(token))
      .send({ teams: [String(arsenal._id), String(arsenal._id)] });
    expect(put.status).toBe(200);
    expect(put.body.data.map((t: { name: string }) => t.name)).toEqual(["Arsenal"]);
    const get = await api.get("/api/me/favorite-teams").set(auth(token));
    expect(get.body.data).toHaveLength(1);

    await ArticleModel.create([
      { title: "A", url: "a", published_at: new Date("2026-09-01"), teams: [arsenal._id] },
      { title: "B", url: "b", published_at: new Date("2026-09-02"), teams: [] },
      { title: "C", url: "c", published_at: new Date("2026-09-03"), teams: [arsenal._id] },
    ]);
    const feed = await api.get("/api/me/feed").set(auth(token));
    expect(feed.body.data.map((a: { title: string }) => a.title)).toEqual(["C", "A"]);

    // Same data through the public list filter.
    const byTeam = await api.get(`/api/articles?filter[teams]=${arsenal._id}`);
    expect(byTeam.body.meta.total).toBe(2);
  });

  it("registers push tokens, moves them between accounts and hides them from /me", async () => {
    const bad = await api.post("/api/me/push-tokens").set(auth(token)).send({ token: "nope" });
    expect(bad.status).toBe(400);

    const t = tokenOf(1);
    expect(
      (await api.post("/api/me/push-tokens").set(auth(token)).send({ token: t, platform: "android" })).status,
    ).toBe(204);
    expect((await api.post("/api/me/push-tokens").set(auth(token)).send({ token: t })).status).toBe(204);
    let bob = await UserModel.findOne({ username: "bob" });
    expect(bob!.push_tokens.map((x) => x.token)).toEqual([t]);

    const me = await api.get("/api/auth/me").set(auth(token));
    expect(me.body).not.toHaveProperty("push_tokens");

    // Same device signs in as someone else: bob no longer gets its pushes.
    const alice = await api
      .post("/api/auth/register")
      .send({ username: "alice", password: "secret1", fullname: "Alice", email: "alice@example.com" });
    await api.post("/api/me/push-tokens").set(auth(alice.body.access_token)).send({ token: t });
    bob = await UserModel.findOne({ username: "bob" });
    expect(bob!.push_tokens).toHaveLength(0);

    const del = await api.delete("/api/me/push-tokens").set(auth(alice.body.access_token)).send({ token: t });
    expect(del.status).toBe(204);
    expect((await UserModel.findOne({ username: "alice" }))!.push_tokens).toHaveLength(0);
  });

  it("keeps at most 5 devices per user", async () => {
    for (let i = 0; i < 7; i++) {
      await api
        .post("/api/me/push-tokens")
        .set(auth(token))
        .send({ token: tokenOf(i) });
    }
    const bob = await UserModel.findOne({ username: "bob" });
    expect(bob!.push_tokens.map((x) => x.token)).toEqual([2, 3, 4, 5, 6].map(tokenOf));
  });
});
