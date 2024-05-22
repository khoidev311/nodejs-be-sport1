import express from "express"
import { createTeam, deleteTeam, getTeamById, getTeams, updateTeam } from "./teamController";
const router = express.Router();

router.get('/', getTeams);
router.get("/:id", getTeamById);
router.post("/", createTeam);
router.put("/:id", updateTeam);
router.delete("/:id", deleteTeam);

export default router
