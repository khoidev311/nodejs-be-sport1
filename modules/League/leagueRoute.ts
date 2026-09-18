import express from "express";
import { leagueController } from "./leagueController";
import { authAdminToken } from "../../middleware/authToken";

const router = express.Router();

router.get("/", leagueController.list);
router.get("/:id", leagueController.getById);
router.post("/", authAdminToken, leagueController.create);
router.put("/:id", authAdminToken, leagueController.update);
router.delete("/:id", authAdminToken, leagueController.remove);

export default router;
