import express from "express"
import { createLeague, deleteLeague, getLeagueById, getLeagues, updateLeague } from "./leagueController";
import { authAdminToken } from "../../middleware/authToken";
const router = express.Router();

router.get('/', getLeagues);
router.get("/:id", getLeagueById);
router.post("/", authAdminToken,createLeague);
router.put("/:id", authAdminToken,updateLeague);
router.delete("/:id",authAdminToken, deleteLeague);

export default router
