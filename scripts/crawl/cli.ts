/**
 * Crawl football data into MongoDB.
 *
 *   npm run crawl -- leagues                        # list leagues the source knows (no DB writes)
 *   npm run crawl -- league ngoai-hang-anh          # full sync of one league (all rounds)
 *   npm run crawl -- league ngoai-hang-anh --rounds current
 *   npm run crawl -- league 36781 --rounds 5,6 --dry-run
 *   npm run crawl -- daily                          # current rounds + standings for DAILY_LEAGUES
 *   npm run crawl -- articles                       # new articles from the news sitemap (~last 2 days)
 *   npm run crawl -- articles --category tin-chuyen-nhuong --pages 5   # backfill a category
 *   npm run crawl -- articles --limit 10 --dry-run [--refresh]
 *
 * Env: MONGODB_URI (+ the usual secrets, config/env.ts requires them),
 *      DAILY_LEAGUES=ngoai-hang-anh,laliga,serie-a,bundesliga,ligue-1,champions-league,v-league
 *      CRAWL_NO_CACHE=1 to bypass the on-disk response cache.
 */
import mongoose from "mongoose";
import connectDB from "../../helper/dbconnect";
import { Client } from "./client";
import { BongdaSource, BASE_URL } from "./sources/bongda";
import { Syncer, type SyncOptions } from "./sync";
import { ArticleSyncer } from "./articles";
import type { LeagueInfo } from "./types";

const DEFAULT_DAILY = "ngoai-hang-anh,laliga,serie-a,bundesliga,ligue-1,champions-league,v-league";

const parseArgs = (argv: string[]) => {
  const [command, ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      flags[k] = v ?? (rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true);
    } else positional.push(a);
  }
  return { command, positional, flags };
};

const roundsOption = (flag: string | true | undefined): SyncOptions["rounds"] => {
  if (!flag || flag === true || flag === "all") return "all";
  if (flag === "current") return "current";
  return flag.split(",").map(Number).filter(Number.isFinite);
};

const findLeague = (leagues: LeagueInfo[], key: string) =>
  leagues.find((l) => l.slug === key || l.season_external_id === key || l.external_id === key);

const main = async () => {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));
  const client = new Client({
    baseUrl: BASE_URL,
    cacheDir: process.env.CRAWL_NO_CACHE ? null : ".cache/crawl",
  });
  const source = new BongdaSource(client);
  const dryRun = flags["dry-run"] === true;
  const log = (m: string) => console.log(m);

  if (command === "leagues") {
    const leagues = await source.leagues();
    for (const l of leagues)
      console.log(
        `${l.slug.padEnd(45)} season=${l.season_external_id.padEnd(6)} ${l.name} (${l.country ?? "-"})`,
      );
    console.log(`${leagues.length} leagues`);
    return;
  }

  if (command === "articles") {
    const num = (f: string | true | undefined) => (typeof f === "string" ? Number(f) : undefined);
    if (!dryRun) await connectDB();
    try {
      const report = await new ArticleSyncer(source, {
        category: typeof flags.category === "string" ? flags.category : undefined,
        pages: num(flags.pages),
        limit: num(flags.limit),
        refresh: flags.refresh === true,
        dryRun,
        log,
      }).sync();
      console.log(JSON.stringify(report));
      if (report.warnings.length) process.exitCode = 1;
    } finally {
      if (!dryRun) await mongoose.disconnect();
    }
    return;
  }

  if (command !== "league" && command !== "daily") {
    console.error(
      "usage: crawl leagues | league <slug|id> [--rounds all|current|1,2] [--dry-run] | daily [--dry-run]\n" +
        "       crawl articles [--category <slug> --pages N] [--limit N] [--refresh] [--dry-run]",
    );
    process.exitCode = 2;
    return;
  }

  const keys =
    command === "daily" ? (process.env.DAILY_LEAGUES || DEFAULT_DAILY).split(",") : positional.slice(0, 1);
  if (keys.length === 0) throw new Error("league: missing <slug|id>");
  const rounds = command === "daily" ? "current" : roundsOption(flags.rounds);

  if (!dryRun) await connectDB();
  try {
    const leagues = await source.leagues();
    for (const key of keys) {
      const info = findLeague(leagues, key.trim());
      if (!info) {
        console.error(`league not found: ${key}`);
        process.exitCode = 1;
        continue;
      }
      const report = await new Syncer(source, { rounds, dryRun, log }).syncLeague(info);
      console.log(JSON.stringify(report));
      if (report.warnings.length) process.exitCode = 1;
    }
  } finally {
    if (!dryRun) await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
