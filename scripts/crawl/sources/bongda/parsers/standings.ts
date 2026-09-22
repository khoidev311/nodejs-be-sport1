import * as cheerio from "cheerio";
import type { StandingInfo } from "../../../types";

const FORM: Record<string, "W" | "D" | "L"> = { T: "W", H: "D", B: "L", W: "W", D: "D", L: "L" };

// div.leaderboard-item > .team (position, link, logo, name) + .copy
// (<p>P W D L GF GA GD Pts</p> then <p class="form">)
export const parseStandings = (fragment: string): StandingInfo[] => {
  const $ = cheerio.load(fragment);
  const out: StandingInfo[] = [];
  $(".leaderboard-item").each((_, item) => {
    const el = $(item);
    const link = el.find(".team a").first();
    const external_id = link.attr("href")?.match(/\/doi-bong\/(\d+)\//)?.[1];
    if (!external_id) return;
    const nums = el
      .find(".copy > p")
      .not(".form")
      .map((_, p) => Number($(p).text().trim()))
      .get();
    if (nums.length < 8 || nums.some(Number.isNaN)) return;
    const [played, win, draw, lost, goals_for, goals_against, goal_diff, points] = nums;
    const form = el
      .find(".form span")
      .map((_, s) => FORM[$(s).text().trim().toUpperCase()])
      .get()
      .filter(Boolean);
    out.push({
      team: {
        external_id,
        name: link.find("p").text().trim(),
        logo: link.find("img").attr("src") || "",
      },
      position: Number(el.find(".team > span").first().text().trim()),
      played,
      win,
      draw,
      lost,
      goals_for,
      goals_against,
      goal_diff,
      points,
      form,
    });
  });
  return out;
};
