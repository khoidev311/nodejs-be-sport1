import express from "express";
import { scoreController, getScoresByLeagueId } from "./scoreController";
import { authAdminToken } from "../../middleware/authToken";

const router = express.Router();

router.get("/", scoreController.list);
router.get("/league/:id", getScoresByLeagueId);
router.get("/:id", scoreController.getById);
router.post("/", authAdminToken, scoreController.create);
router.put("/:id", authAdminToken, scoreController.update);
router.delete("/:id", authAdminToken, scoreController.remove);

export default router;
