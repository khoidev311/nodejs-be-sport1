import express from "express";
import { teamController } from "./teamController";
import { authAdminToken } from "../../middleware/authToken";
import { validate } from "../../middleware/validate";
import { idParam, listQuery, teamCreate, teamUpdate } from "../../helper/schemas";

const router = express.Router();

router.get("/", validate(listQuery, "query"), teamController.list);
router.get("/:id", validate(idParam, "params"), teamController.getById);
router.post("/", authAdminToken, validate(teamCreate), teamController.create);
router.put("/:id", authAdminToken, validate(idParam, "params"), validate(teamUpdate), teamController.update);
router.delete("/:id", authAdminToken, validate(idParam, "params"), teamController.remove);

export default router;
