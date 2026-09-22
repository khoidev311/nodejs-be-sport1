import express from "express";
import { rankController, getRanksByLeagueId } from "./rankController";
import { authAdminToken } from "../../middleware/authToken";
import { validate } from "../../middleware/validate";
import { idParam, listQuery, rankCreate, rankUpdate } from "../../helper/schemas";

const router = express.Router();

router.get("/", validate(listQuery, "query"), rankController.list);
router.get("/league/:id", validate(idParam, "params"), validate(listQuery, "query"), getRanksByLeagueId);
router.get("/:id", validate(idParam, "params"), rankController.getById);
router.post("/", authAdminToken, validate(rankCreate), rankController.create);
router.put("/:id", authAdminToken, validate(idParam, "params"), validate(rankUpdate), rankController.update);
router.delete("/:id", authAdminToken, validate(idParam, "params"), rankController.remove);

export default router;
