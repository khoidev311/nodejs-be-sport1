import express from "express";
import { configController } from "./configController";
import { authAdminToken } from "../../middleware/authToken";
import { validate } from "../../middleware/validate";
import { idParam, listQuery, configCreate, configUpdate } from "../../helper/schemas";

const router = express.Router();

router.get("/", validate(listQuery, "query"), configController.list);
router.get("/:id", validate(idParam, "params"), configController.getById);
router.post("/", authAdminToken, validate(configCreate), configController.create);
router.put(
  "/:id",
  authAdminToken,
  validate(idParam, "params"),
  validate(configUpdate),
  configController.update,
);
router.delete("/:id", authAdminToken, validate(idParam, "params"), configController.remove);

export default router;
