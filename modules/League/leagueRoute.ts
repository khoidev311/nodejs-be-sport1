import express from "express";
import { leagueController } from "./leagueController";
import { authAdminToken } from "../../middleware/authToken";
import { validate } from "../../middleware/validate";
import { idParam, listQuery, leagueCreate, leagueUpdate } from "../../helper/schemas";

const router = express.Router();

router.get("/", validate(listQuery, "query"), leagueController.list);
router.get("/:id", validate(idParam, "params"), leagueController.getById);
router.post("/", authAdminToken, validate(leagueCreate), leagueController.create);
router.put(
  "/:id",
  authAdminToken,
  validate(idParam, "params"),
  validate(leagueUpdate),
  leagueController.update,
);
router.delete("/:id", authAdminToken, validate(idParam, "params"), leagueController.remove);

export default router;
