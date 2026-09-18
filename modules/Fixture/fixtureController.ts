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

export const fixtureController = createCrudController(FixtureModel, {
  label: "Fixture",
  populate,
  fields: ["host_team", "guest_team", "league", "start_time"],
});

export const getFixturesByLeagueId = asyncHandler(async (req: Request, res: Response) => {
  const { filter, sort, page, perPage } = queryBuilder(req);
  const result = await paginate(
    FixtureModel,
    { ...filter, league: req.params.id },
    { page, perPage, sort: sort ?? "start_time", populate },
  );
  res.status(200).json(result);
});
