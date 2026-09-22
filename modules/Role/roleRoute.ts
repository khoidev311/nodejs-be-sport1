import express from "express";
import { roleController } from "./roleController";
import { authAdminToken } from "../../middleware/authToken";
import { validate } from "../../middleware/validate";
import { idParam, listQuery, roleCreate, roleUpdate } from "../../helper/schemas";

const router = express.Router();

router.get("/", authAdminToken, validate(listQuery, "query"), roleController.list);
router.get("/:id", authAdminToken, validate(idParam, "params"), roleController.getById);
router.post("/", authAdminToken, validate(roleCreate), roleController.create);
router.put("/:id", authAdminToken, validate(idParam, "params"), validate(roleUpdate), roleController.update);
router.delete("/:id", authAdminToken, validate(idParam, "params"), roleController.remove);

export default router;
