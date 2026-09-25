import { Types } from "mongoose";
import { z } from "zod";

export const objectId = z
  .string()
  .refine((v) => Types.ObjectId.isValid(v), { message: "must be a valid ObjectId" });

export const idParam = z.object({ id: objectId });

// Shared list query: ?filter[field]=text&sort=-name&page=1&per_page=20
export const listQuery = z
  .object({
    filter: z.record(z.string(), z.string()).optional(),
    sort: z
      .string()
      .regex(/^-?[A-Za-z_][A-Za-z0-9_.]*(,-?[A-Za-z_][A-Za-z0-9_.]*)*$/, "invalid sort")
      .optional(),
    page: z.coerce.number().int().min(1).optional(),
    per_page: z.coerce.number().int().min(1).max(100).optional(),
    from: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
    to: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  })
  .passthrough();

const name = z.string().trim().min(1).max(100);
const url = z.string().trim().min(1).max(500);

export const roleCreate = z.object({ name, slug: z.string().trim().min(1).max(50).optional() });
export const roleUpdate = roleCreate.partial();

export const configCreate = z.object({ key: z.string().trim().min(1).max(100), value: z.string().max(5000) });
export const configUpdate = configCreate.partial();

export const leagueCreate = z.object({
  name,
  logo: url,
  slug: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
});
export const leagueUpdate = leagueCreate.partial();

export const teamCreate = z.object({
  name,
  logo: url,
  league: objectId.optional(),
  short_name: z.string().trim().max(50).optional(),
  aliases: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});
export const teamUpdate = teamCreate.partial();

export const fixtureCreate = z.object({
  host_team: objectId,
  guest_team: objectId,
  league: objectId,
  start_time: z.coerce.date().optional(),
  round: z.coerce.number().int().min(0).optional(),
  status: z.enum(["scheduled", "live", "finished", "postponed"]).optional(),
  venue: z.string().trim().max(200).optional(),
  home_score: z.coerce.number().int().min(0).optional(),
  away_score: z.coerce.number().int().min(0).optional(),
});
export const fixtureUpdate = fixtureCreate.partial();

// e.g. "2-1"; kept as a string for backwards compatibility with clients.
export const scoreCreate = z.object({
  host_team: objectId,
  guest_team: objectId,
  league: objectId,
  score: z.string().regex(/^\d{1,3}\s*-\s*\d{1,3}$/, 'must look like "2-1"'),
});
export const scoreUpdate = scoreCreate.partial();

const nonNegInt = z.coerce.number().int().min(0);
export const rankCreate = z.object({
  team: objectId,
  league: objectId,
  win: nonNegInt.optional(),
  lost: nonNegInt.optional(),
  draw: nonNegInt.optional(),
  efficiency: z.coerce.number().optional(),
  goal: z.coerce.number().int().optional(),
  rank: nonNegInt.optional(),
  point: nonNegInt.optional(),
  history_match: z
    .array(z.enum(["W", "D", "L"]))
    .max(20)
    .optional(),
  total_match: nonNegInt.optional(),
  goals_for: nonNegInt.optional(),
  goals_against: nonNegInt.optional(),
  goal_diff: z.coerce.number().int().optional(),
});
export const rankUpdate = rankCreate.partial();

const username = z
  .string()
  .trim()
  .min(3)
  .max(50)
  .regex(/^[a-zA-Z0-9_.-]+$/, "letters, digits, _ . - only");
const password = z.string().min(6).max(128);
const email = z.string().trim().email().max(254);

export const registerBody = z.object({ username, password, fullname: name, email });
export const loginBody = z.object({ username: z.string().min(1), password: z.string().min(1) });
export const refreshBody = z.object({ refresh_token: z.string().min(1) });

export const userCreate = z.object({ username, password, fullname: name, email, role: objectId.optional() });
export const userUpdate = userCreate.partial();

export const favoriteTeamsBody = z.object({ teams: z.array(objectId).max(20) });
export const pushTokenBody = z.object({
  token: z
    .string()
    .trim()
    .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, "must be an Expo push token"),
  platform: z.enum(["ios", "android"]).optional(),
});
export const pushTokenDeleteBody = pushTokenBody.pick({ token: true });
