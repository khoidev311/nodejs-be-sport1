import express from "express";
import { rankController, getRanksByLeagueId } from "./rankController";
import { authAdminToken } from "../../middleware/authToken";

const router = express.Router();

router.get("/", rankController.list);
router.get("/league/:id", getRanksByLeagueId);
router.get("/:id", rankController.getById);
router.post("/", authAdminToken, rankController.create);
router.put("/:id", authAdminToken, rankController.update);
router.delete("/:id", authAdminToken, rankController.remove);

export default router;
