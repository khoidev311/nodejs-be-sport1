import express from "express"
import { createTeam, deleteTeam, getTeamById, getTeams, updateTeam } from "./teamController";
import { authAdminToken } from "../../middleware/authToken";
const router = express.Router();

router.get('/', getTeams);
router.get("/:id", getTeamById);
router.post("/",authAdminToken, createTeam);
router.put("/:id",authAdminToken, updateTeam);
router.delete("/:id",authAdminToken, deleteTeam);

export default router
