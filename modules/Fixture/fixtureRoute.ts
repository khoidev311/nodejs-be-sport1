import express from "express";
import { fixtureController, getFixturesByLeagueId } from "./fixtureController";
import { authAdminToken } from "../../middleware/authToken";
import { validate } from "../../middleware/validate";
import { idParam, listQuery, fixtureCreate, fixtureUpdate } from "../../helper/schemas";

const router = express.Router();

router.get("/", validate(listQuery, "query"), fixtureController.list);
router.get("/league/:id", validate(idParam, "params"), validate(listQuery, "query"), getFixturesByLeagueId);
router.get("/:id", validate(idParam, "params"), fixtureController.getById);
router.post("/", authAdminToken, validate(fixtureCreate), fixtureController.create);
router.put(
  "/:id",
  authAdminToken,
  validate(idParam, "params"),
  validate(fixtureUpdate),
  fixtureController.update,
);
router.delete("/:id", authAdminToken, validate(idParam, "params"), fixtureController.remove);

export default router;
