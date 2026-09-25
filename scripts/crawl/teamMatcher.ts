import type { Types } from "mongoose";
import TeamModel from "../../modules/Team/teamModel";

// Lowercase, strip Vietnamese diacritics and punctuation: team names in the
// DB are ASCII ("Cong An Ha Noi") while article tags are not ("công an hà nội").
export const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Built-in aliases keyed by the normalized team name as the crawler stores it.
// Teams can add more through Team.aliases. Keep these unambiguous: an alias
// that ends up on two teams is dropped entirely.
export const DEFAULT_ALIASES: Record<string, string[]> = {
  "manchester united": ["man utd", "man united", "mu", "quy do"],
  "manchester city": ["man city"],
  "tottenham hotspur": ["tottenham", "spurs"],
  "newcastle united": ["newcastle"],
  "brighton hove albion": ["brighton"],
  "afc bournemouth": ["bournemouth"],
  "nottingham forest": ["nottingham"],
  "leeds united": ["leeds"],
  "atletico madrid": ["atletico", "atletico de madrid"],
  "athletic bilbao": ["athletic club", "bilbao"],
  "deportivo alaves": ["alaves"],
  "ssc napoli": ["napoli"],
  inter: ["inter milan", "inter milano"],
  "ac milan": ["milan"],
  juventus: ["juve"],
  roma: ["as roma"],
  "parma calcio 1913": ["parma"],
  "bayern munich": ["bayern", "bayern munchen"],
  "borussia dortmund": ["dortmund", "bvb"],
  "bayer leverkusen": ["leverkusen"],
  "borussia moenchengladbach": ["gladbach", "monchengladbach"],
  "eintracht frankfurt": ["frankfurt"],
  "vfb stuttgart": ["stuttgart"],
  "werder bremen": ["bremen"],
  "paris saint germain": ["psg", "paris sg"],
  "fc porto": ["porto"],
  "sporting cp": ["sporting lisbon"],
  "psv eindhoven": ["psv"],
  "cong an ha noi": ["cahn"],
  "cong an ho chi minh city": ["cong an tp hcm", "cong an tphcm"],
  "hoang anh gia lai": ["hagl"],
  "song lam nghe an": ["slna"],
  "thanh hoa fc": ["thanh hoa"],
  "hong linh ha tinh": ["ha tinh"],
  "truong tuoi dong nai": ["dong nai"],
  "ninh binh club": ["ninh binh"],
  "nam dinh": ["thep xanh nam dinh"],
  viettel: ["the cong viettel"],
};

// Keys shorter than this only match a tag exactly, never inside a title:
// "mu" would otherwise match "mũ", "inter" would match "Inter Miami".
const MIN_TITLE_KEY = 6;

export interface TeamLike {
  _id: Types.ObjectId;
  name: string;
  short_name?: string | null;
  aliases?: string[] | null;
}

export class TeamMatcher {
  private readonly keys = new Map<string, Types.ObjectId>();
  // Longest first, so "cong an ha noi" is consumed before "ha noi fc" could
  // see the "ha noi" inside it.
  private readonly titleKeys: string[];

  constructor(teams: TeamLike[]) {
    const ambiguous = new Set<string>();
    for (const team of teams) {
      const name = normalizeName(team.name);
      const names = [
        team.name,
        team.short_name ?? "",
        ...(team.aliases ?? []),
        ...(DEFAULT_ALIASES[name] ?? []),
      ];
      for (const key of new Set(names.map(normalizeName).filter(Boolean))) {
        const owner = this.keys.get(key);
        if (owner && !owner.equals(team._id)) ambiguous.add(key);
        else this.keys.set(key, team._id);
      }
    }
    for (const key of ambiguous) this.keys.delete(key);
    this.titleKeys = [...this.keys.keys()]
      .filter((k) => k.length >= MIN_TITLE_KEY)
      .sort((a, b) => b.length - a.length);
  }

  static async load() {
    const teams = await TeamModel.find({}, { name: 1, short_name: 1, aliases: 1 }).lean<TeamLike[]>();
    return new TeamMatcher(teams);
  }

  match(article: { title: string; tags?: string[] }): Types.ObjectId[] {
    const found = new Map<string, Types.ObjectId>();
    const add = (id: Types.ObjectId) => found.set(id.toString(), id);
    for (const tag of article.tags ?? []) {
      const id = this.keys.get(normalizeName(tag));
      if (id) add(id);
    }
    let title = ` ${normalizeName(article.title)} `;
    for (const key of this.titleKeys) {
      const needle = ` ${key} `;
      if (!title.includes(needle)) continue;
      add(this.keys.get(key)!);
      title = title.split(needle).join(" | ");
    }
    return [...found.values()];
  }
}
