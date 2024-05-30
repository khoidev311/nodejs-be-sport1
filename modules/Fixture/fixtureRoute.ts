import express from "express"
import { createFixture, deleteFixture, getFixtureById, getFixtureByLeagueId, getFixtures, updateFixture } from "./fixtureController";
import { authAdminToken } from "../../middleware/authToken";
const router = express.Router();

router.get('/', getFixtures);
router.get("/:id", getFixtureById);
router.get("/league/:id", getFixtureByLeagueId);
router.post("/", authAdminToken,createFixture);
router.put("/:id", authAdminToken,updateFixture);
router.delete("/:id", authAdminToken,deleteFixture);

export default router
