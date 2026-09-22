import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Syncer } from "../scripts/crawl/sync";
import type { LeagueInfo, MatchInfo, RoundInfo, Source, StandingInfo } from "../scripts/crawl/types";
import { parseMatches } from "../scripts/crawl/sources/bongda/parsers/matches";
import { parseStandings } from "../scripts/crawl/sources/bongda/parsers/standings";
import LeagueModel from "../modules/League/leagueModel";
import TeamModel from "../modules/Team/teamModel";
import FixtureModel from "../modules/Fixture/fixtureModel";
import ScoreModel from "../modules/Score/scoreModel";
import RankModel from "../modules/Rank/rankModel";

const fragment = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, "fixtures/bongda", name), "utf8")).html as string;

const league: LeagueInfo = {
  external_id: "8",
  season_external_id: "36781",
  name: "Ngoại Hạng Anh",
  slug: "ngoai-hang-anh",
  logo: "https://example.com/pl.png",
  country: "Anh",
};

// Offline source backed by the saved fragments: round 5 (finished) and 6 (upcoming).
class FakeSource implements Source {
  readonly name = "bongda" as const;
  calls = { standings: 0, matches: 0 };
  results = parseMatches(fragment("round-result.json"));
  async leagues() {
    return [league];
  }
  async rounds(): Promise<RoundInfo[]> {
    return [
      { id: "42", number: 5, current: false },
      { id: "43", number: 6, current: true },
      { id: "44", number: 7, current: false },
    ];
  }
  async matches(_l: LeagueInfo, round: RoundInfo): Promise<MatchInfo[]> {
    this.calls.matches++;
    if (round.number === 5) return this.results;
    if (round.number === 6) return parseMatches(fragment("round-fixtures.json"));
    return [];
  }
  async standings(): Promise<StandingInfo[]> {
    this.calls.standings++;
    return parseStandings(fragment("league-table.json"));
  }
}

describe("crawl sync", () => {
  it("upserts league, teams, fixtures, scores and ranks, and is idempotent", async () => {
    const source = new FakeSource();
    const report = await new Syncer(source, { rounds: [5, 6] }).syncLeague(league);
    expect(report).toMatchObject({ fixtures: 20, scores: 10, ranks: 20, rounds: [5, 6], warnings: [] });

    const counts = async () => ({
      leagues: await LeagueModel.countDocuments(),
      teams: await TeamModel.countDocuments(),
      fixtures: await FixtureModel.countDocuments(),
      scores: await ScoreModel.countDocuments(),
      ranks: await RankModel.countDocuments(),
    });
    expect(await counts()).toEqual({ leagues: 1, teams: 20, fixtures: 20, scores: 10, ranks: 20 });

    // Second run changes nothing.
    await new Syncer(source, { rounds: [5, 6] }).syncLeague(league);
    expect(await counts()).toEqual({ leagues: 1, teams: 20, fixtures: 20, scores: 10, ranks: 20 });

    const fulham = await FixtureModel.findOne({ external_id: "5795459" }).populate(
      "host_team guest_team league",
    );
    expect(fulham).toMatchObject({
      status: "finished",
      home_score: 1,
      away_score: 1,
      round: 5,
      source: "bongda",
      host_team: { name: "Fulham" },
      league: { slug: "ngoai-hang-anh" },
    });

    const top = await RankModel.findOne({ rank: 1 }).populate("team").lean();
    expect(top).toMatchObject({
      team: { name: "Manchester City" },
      point: 15,
      total_match: 5,
      goal_diff: 8,
      history_match: ["W", "W", "W", "W", "W"],
    });
  });

  it("updates an existing fixture when the result comes in", async () => {
    const source = new FakeSource();
    await new Syncer(source, { rounds: [6] }).syncLeague(league);
    const before = await FixtureModel.findOne({ external_id: "5795465" });
    expect(before).toMatchObject({ status: "scheduled" });
    expect(before!.home_score).toBeUndefined();

    // Simulate the site now reporting the round-6 Arsenal match as finished.
    const finished = parseMatches(fragment("round-fixtures.json")).map((m) =>
      m.external_id === "5795465" ? { ...m, status: "finished" as const, home_score: 2, away_score: 0 } : m,
    );
    source.matches = async () => finished;
    await new Syncer(source, { rounds: [6] }).syncLeague(league);

    const after = await FixtureModel.findOne({ external_id: "5795465" });
    expect(after).toMatchObject({ status: "finished", home_score: 2, away_score: 0 });
    expect(after!._id.toString()).toBe(before!._id.toString());
    expect(await ScoreModel.findOne({ external_id: "5795465" })).toMatchObject({ score: "2-0" });
  });

  it("picks the current round and its neighbours for --rounds current", async () => {
    const source = new FakeSource();
    const report = await new Syncer(source, { rounds: "current" }).syncLeague(league);
    expect(report.rounds).toEqual([5, 6]); // round 7 returns 0 matches -> skipped with a warning
    expect(report.warnings).toEqual(["round 7: unexpected match count 0, skipped"]);
  });

  it("does not write in dry-run mode", async () => {
    const report = await new Syncer(new FakeSource(), { rounds: [5], dryRun: true }).syncLeague(league);
    expect(report.fixtures).toBe(10);
    expect(await FixtureModel.countDocuments()).toBe(0);
    expect(await LeagueModel.countDocuments()).toBe(0);
  });
});
