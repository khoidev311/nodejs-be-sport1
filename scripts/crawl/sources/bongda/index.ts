import { Client } from "../../client";
import type { LeagueInfo, MatchInfo, RoundInfo, Source, StandingInfo } from "../../types";
import { parseLeaguesPage } from "./parsers/leagues";
import { parseRounds } from "./parsers/rounds";
import { parseMatches } from "./parsers/matches";
import { parseStandings } from "./parsers/standings";

interface FragmentResponse {
  status: string;
  html: string;
}

export const BASE_URL = "https://bongda.com.vn";

export class BongdaSource implements Source {
  readonly name = "bongda" as const;

  constructor(private readonly client: Client = new Client({ baseUrl: BASE_URL })) {}

  // Any league page embeds the full `templates` list; the fixtures tab of
  // a well-known league is a stable place to read it from.
  async leagues(): Promise<LeagueInfo[]> {
    const html = await this.client.text("/giai-dau/36781/fixtures/ngoai-hang-anh");
    return parseLeaguesPage(html);
  }

  async rounds(league: LeagueInfo): Promise<RoundInfo[]> {
    const html = await this.client.text(`/giai-dau/${league.season_external_id}/fixtures/${league.slug}`);
    return parseRounds(html);
  }

  async matches(league: LeagueInfo, round: RoundInfo): Promise<MatchInfo[]> {
    const referer = `${BASE_URL}/giai-dau/${league.season_external_id}/fixtures/${league.slug}`;
    const res = await this.client.json<FragmentResponse>(
      `/api/fixtures/group-by-round?round_type=${round.id}&tournament_id=${league.season_external_id}`,
      { Referer: referer },
    );
    if (res.status !== "success") throw new Error(`bongda: fixtures status=${res.status}`);
    return parseMatches(res.html);
  }

  async standings(league: LeagueInfo): Promise<StandingInfo[]> {
    const referer = `${BASE_URL}/giai-dau/${league.season_external_id}/league-table/${league.slug}`;
    const res = await this.client.json<FragmentResponse>(
      `/api/league-table/home?tournament_id=${league.season_external_id}&is_detail=True&team_ids=`,
      { Referer: referer },
    );
    if (res.status !== "success") throw new Error(`bongda: league-table status=${res.status}`);
    return parseStandings(res.html);
  }
}
