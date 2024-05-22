import express from "express"
import { createLeague, deleteLeague, getLeagueById, getLeagues, updateLeague } from "./leagueController";
const router = express.Router();

router.get('/', getLeagues);
router.get("/:id", getLeagueById);
router.post("/", createLeague);
router.put("/:id", updateLeague);
router.delete("/:id", deleteLeague);

export default router
