import express from "express";
import { fixtureController, getFixturesByLeagueId } from "./fixtureController";
import { authAdminToken } from "../../middleware/authToken";

const router = express.Router();

router.get("/", fixtureController.list);
router.get("/league/:id", getFixturesByLeagueId);
router.get("/:id", fixtureController.getById);
router.post("/", authAdminToken, fixtureController.create);
router.put("/:id", authAdminToken, fixtureController.update);
router.delete("/:id", authAdminToken, fixtureController.remove);

export default router;
