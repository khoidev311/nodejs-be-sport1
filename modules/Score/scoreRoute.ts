import express from "express"
import { createScore, deleteScore, getScoreById, getScoreByLeagueId, getScores, updateScore } from "./scoreController";
import { authAdminToken } from "../../middleware/authToken";
const router = express.Router();

router.get('/', getScores);
router.get("/:id", getScoreById);
router.get("/league/:id", getScoreByLeagueId);
router.post("/", authAdminToken, createScore);
router.put("/:id",authAdminToken, updateScore);
router.delete("/:id", authAdminToken, deleteScore);

export default router
