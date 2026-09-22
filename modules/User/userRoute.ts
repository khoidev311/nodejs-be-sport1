import express from "express";
import { userController } from "./userController";
import { authAdminToken } from "../../middleware/authToken";
import { validate } from "../../middleware/validate";
import { idParam, listQuery, userCreate, userUpdate } from "../../helper/schemas";

const router = express.Router();

router.use(authAdminToken);
router.get("/", validate(listQuery, "query"), userController.list);
router.get("/:id", validate(idParam, "params"), userController.getById);
router.post("/", validate(userCreate), userController.create);
router.put("/:id", validate(idParam, "params"), validate(userUpdate), userController.update);
router.delete("/:id", validate(idParam, "params"), userController.remove);

export default router;
