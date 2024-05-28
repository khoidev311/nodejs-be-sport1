import express from "express"
import { createFixture, deleteFixture, getFixtureById, getFixtureByLeagueId, getFixtures, updateFixture } from "./fixtureController";
const router = express.Router();

router.get('/', getFixtures);
router.get("/:id", getFixtureById);
router.get("/league/:id", getFixtureByLeagueId);
router.post("/", createFixture);
router.put("/:id", updateFixture);
router.delete("/:id", deleteFixture);

export default router
