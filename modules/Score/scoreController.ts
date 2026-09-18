import { Request, Response } from "express";
import ScoreModel from "./scoreModel";
import { createCrudController } from "../../helper/crud";
import { asyncHandler } from "../../helper/http";
import { paginate, queryBuilder } from "../../helper/commonHelper";

const populate = [
  { path: "host_team", model: "Team" },
  { path: "guest_team", model: "Team" },
  { path: "league", model: "League" },
];

export const scoreController = createCrudController(ScoreModel, {
  label: "Score",
  populate,
  fields: ["host_team", "guest_team", "league", "score"],
});

export const getScoresByLeagueId = asyncHandler(async (req: Request, res: Response) => {
  const { filter, sort, page, perPage } = queryBuilder(req);
  const result = await paginate(ScoreModel, { ...filter, league: req.params.id }, { page, perPage, sort, populate });
  res.status(200).json(result);
});
