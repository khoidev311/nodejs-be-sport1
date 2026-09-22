import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMatches, parseVietnamTime } from "../scripts/crawl/sources/bongda/parsers/matches";
import { parseStandings } from "../scripts/crawl/sources/bongda/parsers/standings";
import { parseRounds } from "../scripts/crawl/sources/bongda/parsers/rounds";
import { parseTemplates, pythonLiteralToJson } from "../scripts/crawl/sources/bongda/parsers/leagues";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures/bongda", name), "utf8");
const fragment = (name: string) => JSON.parse(fixture(name)).html as string;

describe("bongda parsers", () => {
  it("parses a finished round with scores", () => {
    const matches = parseMatches(fragment("round-result.json"));
    expect(matches).toHaveLength(10);
    const fulham = matches.find((m) => m.home.name === "Fulham")!;
    expect(fulham).toMatchObject({
      external_id: "5795459",
      round: 5,
      status: "finished",
      home_score: 1,
      away_score: 1,
      venue: "Craven Cottage",
      home: { external_id: "830", name: "Fulham" },
      away: { external_id: "1029", name: "Manchester United" },
    });
    expect(fulham.home.logo).toMatch(/^https:\/\/media\.bongda\.com\.vn\//);
    // 22:30 Vietnam time on 20-09-2026 = 15:30 UTC
    expect(fulham.start_time.toISOString()).toBe("2026-09-20T15:30:00.000Z");
    expect(matches.every((m) => m.status === "finished")).toBe(true);
  });

  it("parses an upcoming round without scores", () => {
    const matches = parseMatches(fragment("round-fixtures.json"));
    expect(matches).toHaveLength(10);
    const arsenal = matches.find((m) => m.home.name === "Arsenal")!;
    expect(arsenal).toMatchObject({
      external_id: "5795465",
      round: 6,
      status: "scheduled",
      venue: "Emirates Stadium",
    });
    expect(arsenal.home_score).toBeUndefined();
    expect(arsenal.start_time.toISOString()).toBe("2026-10-10T11:30:00.000Z");
    // 10 matches, distinct ids, 20 distinct teams
    expect(new Set(matches.map((m) => m.external_id)).size).toBe(10);
    expect(new Set(matches.flatMap((m) => [m.home.external_id, m.away.external_id])).size).toBe(20);
  });

  it("parses the league table", () => {
    const rows = parseStandings(fragment("league-table.json"));
    expect(rows).toHaveLength(20);
    expect(rows[0]).toMatchObject({
      position: 1,
      team: { external_id: "854", name: "Manchester City" },
      played: 5,
      win: 5,
      draw: 0,
      lost: 0,
      goals_for: 13,
      goals_against: 5,
      goal_diff: 8,
      points: 15,
      form: ["W", "W", "W", "W", "W"],
    });
    expect(rows.map((r) => r.position)).toEqual([...Array(20)].map((_, i) => i + 1));
    for (const r of rows) {
      expect(r.win + r.draw + r.lost).toBe(r.played);
      expect(r.goals_for - r.goals_against).toBe(r.goal_diff);
    }
  });

  it("parses the round selector", () => {
    const rounds = parseRounds(fixture("round-select.html"));
    expect(rounds).toHaveLength(38);
    expect(rounds[0]).toEqual({ id: "38", number: 1, current: false });
    expect(rounds.find((r) => r.current)).toEqual({ id: "43", number: 6, current: true });
  });

  it("parses the league templates list", () => {
    const leagues = parseTemplates(JSON.parse(fixture("templates.json")));
    expect(leagues.length).toBeGreaterThan(100);
    expect(leagues.find((l) => l.slug === "ngoai-hang-anh")).toMatchObject({
      external_id: "8",
      season_external_id: "36781",
      name: "Ngoại Hạng Anh",
      country: "Anh",
    });
    expect(leagues.find((l) => l.slug === "laliga")?.season_external_id).toBe("38843");
  });

  it("converts python literals to JSON", () => {
    const lit = `[{'id': 1, 'name': 'C\\u00f4te d\\'Ivoire', 'ok': True, 'x': None, 'q': 'say "hi"'}]`;
    expect(JSON.parse(pythonLiteralToJson(lit))).toEqual([
      { id: 1, name: "Côte d'Ivoire", ok: true, x: null, q: 'say "hi"' },
    ]);
  });

  it("parses Vietnam-time strings and rejects garbage", () => {
    expect(parseVietnamTime("18:30 - 10-10-2026")?.toISOString()).toBe("2026-10-10T11:30:00.000Z");
    expect(parseVietnamTime("VS")).toBeNull();
  });
});
