import { Request, Response } from "express";
import RankModel from "./rankModel";
import { createCrudController } from "../../helper/crud";
import { asyncHandler } from "../../helper/http";
import { paginate, queryBuilder } from "../../helper/commonHelper";

const populate = [
  { path: "team", model: "Team" },
  { path: "league", model: "League" },
];

export const rankController = createCrudController(RankModel, {
  label: "Rank",
  populate,
  fields: ["win", "lost", "draw", "efficiency", "goal", "rank", "point", "history_match", "total_match", "team", "league"],
});

// A league table: ranks of one league ordered by position.
export const getRanksByLeagueId = asyncHandler(async (req: Request, res: Response) => {
  const { filter, sort, page, perPage } = queryBuilder(req);
  const result = await paginate(
    RankModel,
    { ...filter, league: req.params.id },
    { page, perPage, sort: sort ?? "rank", populate },
  );
  res.status(200).json(result);
});
