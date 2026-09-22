// Normalised shapes every source adapter must produce. Ids are the source's
// own ids as strings; mapping to Mongo ObjectIds happens in sync.ts.

export interface LeagueInfo {
  external_id: string; // season-independent id
  season_external_id: string; // id of the current season (what the APIs take)
  name: string;
  slug: string;
  logo: string;
  country?: string;
}

export interface RoundInfo {
  id: string; // opaque id the source uses for the round
  number: number; // 1-based round number
  current: boolean;
}

export type MatchStatus = "scheduled" | "live" | "finished" | "postponed";

export interface TeamRef {
  external_id: string;
  name: string;
  logo: string;
}

export interface MatchInfo {
  external_id: string;
  round?: number;
  start_time: Date;
  home: TeamRef;
  away: TeamRef;
  status: MatchStatus;
  home_score?: number;
  away_score?: number;
  venue?: string;
}

export interface StandingInfo {
  team: TeamRef;
  position: number;
  played: number;
  win: number;
  draw: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  form: ("W" | "D" | "L")[];
}

export interface Source {
  readonly name: "bongda";
  leagues(): Promise<LeagueInfo[]>;
  rounds(league: LeagueInfo): Promise<RoundInfo[]>;
  matches(league: LeagueInfo, round: RoundInfo): Promise<MatchInfo[]>;
  standings(league: LeagueInfo): Promise<StandingInfo[]>;
}
