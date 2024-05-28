import express from "express"
import { createScore, deleteScore, getScoreById, getScoreByLeagueId, getScores, updateScore } from "./scoreController";
const router = express.Router();

router.get('/', getScores);
router.get("/:id", getScoreById);
router.get("/league/:id", getScoreByLeagueId);
router.post("/", createScore);
router.put("/:id", updateScore);
router.delete("/:id", deleteScore);

export default router
