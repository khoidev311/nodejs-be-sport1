import express from "express";
import {
  getFavoriteTeams,
  getFeed,
  registerPushToken,
  removePushToken,
  setFavoriteTeams,
} from "./meController";
import { authenticate } from "../../middleware/authToken";
import { validate } from "../../middleware/validate";
import { favoriteTeamsBody, listQuery, pushTokenBody, pushTokenDeleteBody } from "../../helper/schemas";

// Everything here is about the signed-in user.
const router = express.Router();

router.use(authenticate);
router.get("/favorite-teams", getFavoriteTeams);
router.put("/favorite-teams", validate(favoriteTeamsBody), setFavoriteTeams);
router.get("/feed", validate(listQuery, "query"), getFeed);
router.post("/push-tokens", validate(pushTokenBody), registerPushToken);
router.delete("/push-tokens", validate(pushTokenDeleteBody), removePushToken);

export default router;
