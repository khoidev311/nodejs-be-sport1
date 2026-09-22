import express from "express";
import { scoreController, getScoresByLeagueId } from "./scoreController";
import { authAdminToken } from "../../middleware/authToken";
import { validate } from "../../middleware/validate";
import { idParam, listQuery, scoreCreate, scoreUpdate } from "../../helper/schemas";

const router = express.Router();

router.get("/", validate(listQuery, "query"), scoreController.list);
router.get("/league/:id", validate(idParam, "params"), validate(listQuery, "query"), getScoresByLeagueId);
router.get("/:id", validate(idParam, "params"), scoreController.getById);
router.post("/", authAdminToken, validate(scoreCreate), scoreController.create);
router.put(
  "/:id",
  authAdminToken,
  validate(idParam, "params"),
  validate(scoreUpdate),
  scoreController.update,
);
router.delete("/:id", authAdminToken, validate(idParam, "params"), scoreController.remove);

export default router;
