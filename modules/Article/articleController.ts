import { Request, Response } from "express";
import ArticleModel from "./articleModel";
import { createCrudController } from "../../helper/crud";
import { asyncHandler } from "../../helper/http";
import { paginate, queryBuilder } from "../../helper/commonHelper";

// Newest first by default; ?from=&to= filter on published_at.
export const listArticles = asyncHandler(async (req: Request, res: Response) => {
  const { filter, sort, page, perPage, from, to } = queryBuilder(req);
  const range = from || to ? { published_at: { ...(from && { $gte: from }), ...(to && { $lte: to }) } } : {};
  res
    .status(200)
    .json(
      await paginate(ArticleModel, { ...filter, ...range }, { page, perPage, sort: sort ?? "-published_at" }),
    );
});

export const articleController = createCrudController(ArticleModel, { label: "Article", fields: [] });
