import { Request, Response } from "express";
import ArticleModel from "../Article/articleModel";
import TeamModel from "../Team/teamModel";
import UserModel, { MAX_PUSH_TOKENS } from "../User/userModel";
import { asyncHandler, HttpError } from "../../helper/http";
import { paginate, queryBuilder } from "../../helper/commonHelper";

// Re-registering the same token within this window is a no-op, so the app
// can call POST /push-tokens on every launch without a DB write each time.
const TOKEN_REFRESH_MS = 24 * 3_600_000;

const teamFields = { name: 1, short_name: 1, logo: 1, league: 1 };

// req.user is loaded by the authenticate middleware, so reading the user's
// own favorites/tokens costs no extra query.
const getFavoriteTeams = asyncHandler(async (req: Request, res: Response) => {
  const ids = req.user!.favorite_teams;
  res.status(200).json({ data: ids.length ? await TeamModel.find({ _id: { $in: ids } }, teamFields) : [] });
});

const setFavoriteTeams = asyncHandler(async (req: Request, res: Response) => {
  const ids = [...new Set<string>(req.body.teams)];
  const teams = ids.length ? await TeamModel.find({ _id: { $in: ids } }, teamFields) : [];
  if (teams.length !== ids.length) throw new HttpError(400, "Unknown team id");
  await UserModel.updateOne({ _id: req.user!._id }, { $set: { favorite_teams: ids } });
  res.status(200).json({ data: teams });
});

// Articles about any favorite team, newest first; same envelope as /api/articles.
const getFeed = asyncHandler(async (req: Request, res: Response) => {
  const { page, perPage } = queryBuilder(req);
  const ids = req.user!.favorite_teams;
  if (!ids.length) {
    return res.status(200).json({ data: [], meta: { total: 0, current: page, per_page: perPage, pages: 0 } });
  }
  res
    .status(200)
    .json(await paginate(ArticleModel, { teams: { $in: ids } }, { page, perPage, sort: "-published_at" }));
});

const registerPushToken = asyncHandler(async (req: Request, res: Response) => {
  const { token, platform } = req.body;
  const user = req.user!;
  const current = (user.push_tokens as { token: string; updated_at?: Date }[]).find((t) => t.token === token);
  if (current?.updated_at && Date.now() - current.updated_at.getTime() < TOKEN_REFRESH_MS) {
    return res.status(204).end();
  }
  // A device belongs to one account: after a switch, the previous account
  // must stop receiving pushes on it.
  await UserModel.updateMany({ "push_tokens.token": token }, { $pull: { push_tokens: { token } } });
  await UserModel.updateOne(
    { _id: user._id },
    {
      $push: {
        push_tokens: { $each: [{ token, platform, updated_at: new Date() }], $slice: -MAX_PUSH_TOKENS },
      },
    },
  );
  res.status(204).end();
});

// Call on logout, before dropping the access token.
const removePushToken = asyncHandler(async (req: Request, res: Response) => {
  await UserModel.updateOne({ _id: req.user!._id }, { $pull: { push_tokens: { token: req.body.token } } });
  res.status(204).end();
});

export { getFavoriteTeams, setFavoriteTeams, getFeed, registerPushToken, removePushToken };
