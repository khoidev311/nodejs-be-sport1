import { Request, Response } from "express";
import FixtureModel from "./fixtureModel";
import { createCrudController } from "../../helper/crud";
import { asyncHandler } from "../../helper/http";
import { paginate, queryBuilder } from "../../helper/commonHelper";

const populate = [
  { path: "host_team", model: "Team" },
  { path: "guest_team", model: "Team" },
  { path: "league", model: "League" },
];

// Fixtures support ?from=&to= (ISO date/datetime) on start_time in addition
// to the generic filter/sort/pagination.
const timeRange = (from?: Date, to?: Date) => {
  if (!from && !to) return {};
  return { start_time: { ...(from && { $gte: from }), ...(to && { $lte: to }) } };
};

export const listFixtures = asyncHandler(async (req: Request, res: Response) => {
  const { filter, sort, page, perPage, from, to } = queryBuilder(req);
  res
    .status(200)
    .json(
      await paginate(FixtureModel, { ...filter, ...timeRange(from, to) }, { page, perPage, sort, populate }),
    );
});

export const fixtureController = createCrudController(FixtureModel, {
  label: "Fixture",
  populate,
  fields: [
    "host_team",
    "guest_team",
    "league",
    "start_time",
    "round",
    "status",
    "venue",
    "home_score",
    "away_score",
  ],
});

export const getFixturesByLeagueId = asyncHandler(async (req: Request, res: Response) => {
  const { filter, sort, page, perPage, from, to } = queryBuilder(req);
  const result = await paginate(
    FixtureModel,
    { ...filter, ...timeRange(from, to), league: req.params.id },
    { page, perPage, sort: sort ?? "start_time", populate },
  );
  res.status(200).json(result);
});
