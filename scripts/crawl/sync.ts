import { Types } from "mongoose";
import LeagueModel from "../../modules/League/leagueModel";
import TeamModel from "../../modules/Team/teamModel";
import FixtureModel from "../../modules/Fixture/fixtureModel";
import ScoreModel from "../../modules/Score/scoreModel";
import RankModel from "../../modules/Rank/rankModel";
import type { LeagueInfo, MatchInfo, RoundInfo, Source, StandingInfo, TeamRef } from "./types";

export interface SyncOptions {
  rounds: "all" | "current" | number[]; // which round numbers to fetch
  dryRun?: boolean;
  log?: (msg: string) => void;
}

export interface SyncReport {
  league: string;
  teams: number;
  fixtures: number;
  scores: number;
  ranks: number;
  rounds: number[];
  warnings: string[];
}

// Guards against writing garbage when the site's markup changes: a round
// with no matches or a table with too few rows aborts the sync.
const sanity = {
  matchesPerRound: (n: number) => n >= 1 && n <= 40,
  standingsRows: (n: number) => n >= 2 && n <= 40,
};

export class Syncer {
  private teamIds = new Map<string, Types.ObjectId>();
  private matchCache = new Map<string, MatchInfo[]>();
  private readonly log: (msg: string) => void;

  constructor(
    private readonly source: Source,
    private readonly opts: SyncOptions,
  ) {
    this.log = opts.log ?? (() => {});
  }

  async upsertLeague(info: LeagueInfo): Promise<Types.ObjectId> {
    const doc = await LeagueModel.findOneAndUpdate(
      { source: this.source.name, external_id: info.external_id },
      {
        $set: {
          name: info.name,
          slug: info.slug,
          logo: info.logo || "https://media.bongda.com.vn/static/images/default-league.png",
          country: info.country,
          season_external_id: info.season_external_id,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return doc._id;
  }

  // Teams are keyed by external_id; `league` is set on first sight only
  // (a club's domestic league) so cup competitions don't overwrite it.
  private async upsertTeam(ref: TeamRef, leagueId: Types.ObjectId): Promise<Types.ObjectId> {
    const cached = this.teamIds.get(ref.external_id);
    if (cached) return cached;
    const doc = await TeamModel.findOneAndUpdate(
      { source: this.source.name, external_id: ref.external_id },
      {
        $set: {
          name: ref.name,
          logo: ref.logo || "https://media.bongda.com.vn/static/images/default-team.png",
        },
        $setOnInsert: { league: leagueId },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    this.teamIds.set(ref.external_id, doc._id);
    return doc._id;
  }

  private async upsertMatch(m: MatchInfo, leagueId: Types.ObjectId): Promise<{ score: boolean }> {
    const [host_team, guest_team] = await Promise.all([
      this.upsertTeam(m.home, leagueId),
      this.upsertTeam(m.away, leagueId),
    ]);
    const set: Record<string, unknown> = {
      host_team,
      guest_team,
      league: leagueId,
      start_time: m.start_time,
      round: m.round,
      status: m.status,
      venue: m.venue,
      home_score: m.home_score,
      away_score: m.away_score,
    };
    await FixtureModel.updateOne(
      { source: this.source.name, external_id: m.external_id },
      { $set: set },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    // Keep the legacy Score collection in step for clients that still read it.
    if (m.status === "finished" && m.home_score !== undefined && m.away_score !== undefined) {
      await ScoreModel.updateOne(
        { source: this.source.name, external_id: m.external_id },
        { $set: { host_team, guest_team, league: leagueId, score: `${m.home_score}-${m.away_score}` } },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true },
      );
      return { score: true };
    }
    return { score: false };
  }

  private async upsertStanding(row: StandingInfo, leagueId: Types.ObjectId) {
    const team = await this.upsertTeam(row.team, leagueId);
    await RankModel.updateOne(
      { league: leagueId, team },
      {
        $set: {
          rank: row.position,
          point: row.points,
          win: row.win,
          draw: row.draw,
          lost: row.lost,
          total_match: row.played,
          goals_for: row.goals_for,
          goals_against: row.goals_against,
          goal_diff: row.goal_diff,
          goal: row.goal_diff,
          efficiency: row.played ? Number((row.points / (row.played * 3)).toFixed(3)) : 0,
          history_match: row.form,
          source: this.source.name,
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  private async fetchMatches(info: LeagueInfo, round: RoundInfo): Promise<MatchInfo[]> {
    const cached = this.matchCache.get(round.id);
    if (cached) return cached;
    const matches = await this.source.matches(info, round);
    this.matchCache.set(round.id, matches);
    return matches;
  }

  private async allFinished(info: LeagueInfo, round: RoundInfo): Promise<boolean> {
    const matches = await this.fetchMatches(info, round);
    return matches.length > 0 && matches.every((m) => m.status === "finished");
  }

  // "current": the first round that is not fully played, plus its
  // neighbours, so a daily run refreshes late results and upcoming
  // fixtures. The site's `selected` option is unreliable (Ligue 1 pointed
  // at round 1 mid-season), so binary-search on the data instead: rounds
  // are chronological, so "all finished" is monotonic.
  private async currentRounds(info: LeagueInfo, rounds: RoundInfo[]): Promise<RoundInfo[]> {
    let lo = 0;
    let hi = rounds.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (await this.allFinished(info, rounds[mid])) lo = mid + 1;
      else hi = mid;
    }
    const idx = Math.min(lo, rounds.length - 1);
    return rounds.slice(Math.max(0, idx - 1), idx + 2);
  }

  private async pickRounds(info: LeagueInfo, rounds: RoundInfo[]): Promise<RoundInfo[]> {
    const sel = this.opts.rounds;
    if (sel === "all") return rounds;
    if (Array.isArray(sel)) return rounds.filter((r) => sel.includes(r.number));
    return this.currentRounds(info, rounds);
  }

  async syncLeague(info: LeagueInfo): Promise<SyncReport> {
    const report: SyncReport = {
      league: info.name,
      teams: 0,
      fixtures: 0,
      scores: 0,
      ranks: 0,
      rounds: [],
      warnings: [],
    };
    this.log(`[${info.name}] league ${info.external_id} / season ${info.season_external_id}`);
    const leagueId = this.opts.dryRun ? new Types.ObjectId() : await this.upsertLeague(info);

    const standings = await this.source.standings(info);
    if (!sanity.standingsRows(standings.length)) {
      report.warnings.push(`standings: unexpected row count ${standings.length}, skipped`);
    } else if (!this.opts.dryRun) {
      for (const row of standings) await this.upsertStanding(row, leagueId);
      report.ranks = standings.length;
    } else {
      report.ranks = standings.length;
    }
    this.log(`[${info.name}] standings: ${standings.length} rows`);

    const rounds = await this.pickRounds(info, await this.source.rounds(info));
    for (const round of rounds) {
      const matches = await this.fetchMatches(info, round);
      if (!sanity.matchesPerRound(matches.length)) {
        report.warnings.push(`round ${round.number}: unexpected match count ${matches.length}, skipped`);
        continue;
      }
      report.rounds.push(round.number);
      for (const m of matches) {
        if (this.opts.dryRun) {
          report.fixtures++;
          if (m.status === "finished") report.scores++;
          continue;
        }
        const { score } = await this.upsertMatch(m, leagueId);
        report.fixtures++;
        if (score) report.scores++;
      }
      this.log(`[${info.name}] round ${round.number}: ${matches.length} matches`);
    }
    report.teams = this.teamIds.size;
    return report;
  }
}
