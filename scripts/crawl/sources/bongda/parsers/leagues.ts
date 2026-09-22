import type { LeagueInfo } from "../../../types";

// The site embeds its league list as a Python-repr literal inside
// `let templates = [...]` (single-quoted strings, True/False/None). Convert
// it to JSON without eval.
export const pythonLiteralToJson = (lit: string): string => {
  let out = "";
  let i = 0;
  while (i < lit.length) {
    const c = lit[i];
    if (c === "'" || c === '"') {
      const quote = c;
      let str = "";
      i++;
      while (i < lit.length && lit[i] !== quote) {
        if (lit[i] === "\\") {
          const n = lit[i + 1];
          if (n === quote) str += quote;
          else if (n === "\\") str += "\\";
          else if (n === "n") str += "\n";
          else if (n === "t") str += "\t";
          else if (n === "u") {
            str += String.fromCharCode(parseInt(lit.slice(i + 2, i + 6), 16));
            i += 4;
          } else str += n;
          i += 2;
        } else {
          str += lit[i++];
        }
      }
      i++; // closing quote
      out += JSON.stringify(str);
    } else if (lit.startsWith("True", i)) {
      out += "true";
      i += 4;
    } else if (lit.startsWith("False", i)) {
      out += "false";
      i += 5;
    } else if (lit.startsWith("None", i)) {
      out += "null";
      i += 4;
    } else {
      out += c;
      i++;
    }
  }
  return out;
};

// Extracts the `let templates = [...]` array literal from a page.
export const extractTemplatesLiteral = (html: string): string | null => {
  const marker = "let templates = ";
  const start = html.indexOf(marker);
  if (start < 0) return null;
  let i = start + marker.length;
  let depth = 0;
  let quote: string | null = null;
  for (; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === "'" || c === '"') quote = c;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) return html.slice(start + marker.length, i + 1);
  }
  return null;
};

interface Template {
  id: number;
  name: string;
  name_show?: string;
  slug: string;
  logo_template?: string;
  value?: string;
  current_tournament?: string;
  country_name?: string;
}

export const parseTemplates = (templates: Template[]): LeagueInfo[] =>
  templates
    .filter((t) => t.slug && (t.current_tournament || t.value))
    .map((t) => ({
      external_id: String(t.id),
      season_external_id: String(t.current_tournament || t.value),
      name: (t.name_show || t.name).trim(),
      slug: t.slug,
      logo: t.logo_template || "",
      country: t.country_name?.trim() || undefined,
    }));

export const parseLeaguesPage = (html: string): LeagueInfo[] => {
  const lit = extractTemplatesLiteral(html);
  if (!lit) throw new Error("bongda: `let templates = [...]` not found in page");
  return parseTemplates(JSON.parse(pythonLiteralToJson(lit)) as Template[]);
};
