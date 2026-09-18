import express from "express";
import { userController } from "./userController";
import { authAdminToken } from "../../middleware/authToken";

const router = express.Router();

router.get("/", authAdminToken, userController.list);
router.get("/:id", authAdminToken, userController.getById);
router.post("/", authAdminToken, userController.create);
router.put("/:id", authAdminToken, userController.update);
router.delete("/:id", authAdminToken, userController.remove);

export default router;
