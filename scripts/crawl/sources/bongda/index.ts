import type {
  ArticleInfo,
  ArticleRef,
  ArticleSource,
  LeagueInfo,
  MatchInfo,
  RoundInfo,
  Source,
  StandingInfo,
} from "../../types";
import { parseLeaguesPage } from "./parsers/leagues";
import { parseRounds } from "./parsers/rounds";
import { parseMatches } from "./parsers/matches";
import { parseStandings } from "./parsers/standings";
import { parseArticlePage, parseCategoryPage, parseNewsSitemap } from "./parsers/articles";
import { Client, HttpStatusError } from "../../client";

interface FragmentResponse {
  status: string;
  html: string;
}

export const BASE_URL = "https://bongda.com.vn";

export class BongdaSource implements Source, ArticleSource {
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

  // Google News sitemap: every article of the last ~2 days.
  async recentArticles(): Promise<ArticleRef[]> {
    return parseNewsSitemap(await this.client.text("/news-sitemap.xml"));
  }

  // For backfilling past the sitemap window, e.g. category "tin-chuyen-nhuong".
  async categoryArticles(category: string, page: number): Promise<ArticleRef[]> {
    const path = `/${encodeURIComponent(category)}${page > 1 ? `?page=${page}` : ""}`;
    return parseCategoryPage(await this.client.text(path));
  }

  // null when the article is gone (404) or its page lacks title/date.
  async article(ref: ArticleRef): Promise<ArticleInfo | null> {
    try {
      return parseArticlePage(await this.client.text(ref.url), ref);
    } catch (err) {
      if (err instanceof HttpStatusError && err.status === 404) return null;
      throw err;
    }
  }
}
