import express from "express"
import { createScore, deleteScore, getScoreById, getScores, updateScore } from "./scoreController";
const router = express.Router();

router.get('/', getScores);
router.get("/:id", getScoreById);
router.post("/", createScore);
router.put("/:id", updateScore);
router.delete("/:id", deleteScore);

export default router
