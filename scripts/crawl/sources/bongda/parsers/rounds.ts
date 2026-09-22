import * as cheerio from "cheerio";
import type { RoundInfo } from "../../../types";

// <select id="league-round"><option value="43" selected>Vòng 6</option>...
export const parseRounds = (html: string): RoundInfo[] => {
  const $ = cheerio.load(html);
  const rounds: RoundInfo[] = [];
  $("select#league-round option").each((_, el) => {
    const id = $(el).attr("value");
    const m = $(el).text().match(/(\d+)/);
    if (!id || !m) return;
    rounds.push({ id, number: Number(m[1]), current: $(el).is("[selected]") });
  });
  return rounds;
};
