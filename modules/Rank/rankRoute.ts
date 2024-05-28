import express from "express"
import { createRank, deleteRank, getRankById, getRankByLeagueId, getRanks, updateRank } from "./rankController";
const router = express.Router();

router.get('/', getRanks);
router.get("/:id", getRankById);
router.get("/league/:id", getRankByLeagueId);
router.post("/", createRank);
router.put("/:id", updateRank);
router.delete("/:id", deleteRank);

export default router
