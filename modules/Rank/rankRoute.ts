import express from "express"
import { createRank, deleteRank, getRankById, getRankByLeagueId, getRanks, updateRank } from "./rankController";
import { authAdminToken } from "../../middleware/authToken";
const router = express.Router();

router.get('/', getRanks);
router.get("/:id", getRankById);
router.get("/league/:id", getRankByLeagueId);
router.post("/", authAdminToken,createRank);
router.put("/:id", authAdminToken,updateRank);
router.delete("/:id", authAdminToken,deleteRank);

export default router
