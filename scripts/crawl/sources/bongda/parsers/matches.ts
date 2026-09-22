import * as cheerio from "cheerio";
import type { MatchInfo, MatchStatus, TeamRef } from "../../../types";

const teamIdFromHref = (href = "") => href.match(/\/doi-bong\/(\d+)\//)?.[1];
const matchIdFromHref = (href = "") => href.match(/\/tran-dau\/(\d+)\//)?.[1];

// "22:30 - 20-09-2026" in Vietnam time (UTC+7) -> Date
export const parseVietnamTime = (text: string): Date | null => {
  const m = text.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (!m) return null;
  const [, hh, mm, dd, MM, yyyy] = m;
  return new Date(
    `${yyyy}-${MM.padStart(2, "0")}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${mm}:00+07:00`,
  );
};

// Labels the site shows in .status .label. "KT" = kết thúc (full time).
const statusFromLabel = (label: string, hasScore: boolean): MatchStatus => {
  const l = label.trim().toUpperCase();
  if (l === "KT" || l === "FT" || l === "AET" || l === "PEN") return "finished";
  if (/HO[ÃA]N|POSTP|HUỶ|HỦY|CANC/i.test(label)) return "postponed";
  if (l === "" && !hasScore) return "scheduled";
  return hasScore ? "live" : "scheduled";
};

export const parseMatches = (fragment: string): MatchInfo[] => {
  const $ = cheerio.load(fragment);
  const out: MatchInfo[] = [];
  $("li.match-detail").each((_, li) => {
    const el = $(li);
    const team = (sel: string): TeamRef | null => {
      const a = el.find(sel).first();
      const id = teamIdFromHref(a.attr("href"));
      if (!id) return null;
      return {
        external_id: id,
        name: (a.attr("title") || a.find(".name").text()).trim(),
        logo: a.find("img").attr("src") || "",
      };
    };
    const home = team("a.home-team");
    const away = team("a.away-team");
    const statusLink = el.find(".status a").first();
    const external_id = matchIdFromHref(statusLink.attr("href"));
    const start_time = parseVietnamTime(el.find(".match-time").text());
    if (!home || !away || !external_id || !start_time) return;

    const spans = statusLink
      .find("span")
      .not(".label")
      .map((_, s) => $(s).text().trim())
      .get();
    const nums = spans.filter((s) => /^\d+$/.test(s)).map(Number);
    const hasScore = nums.length >= 2;
    const label = statusLink.find(".label").text();
    const roundText = el.find(".round strong").text().trim();

    out.push({
      external_id,
      round: roundText ? Number(roundText) : undefined,
      start_time,
      home,
      away,
      status: statusFromLabel(label, hasScore),
      home_score: hasScore ? nums[0] : undefined,
      away_score: hasScore ? nums[1] : undefined,
      venue: el.find(".venue").text().trim() || undefined,
    });
  });
  return out;
};
