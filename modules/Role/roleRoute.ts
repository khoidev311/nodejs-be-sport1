import express from "express";
import { roleController } from "./roleController";
import { authAdminToken } from "../../middleware/authToken";

const router = express.Router();

router.get("/", authAdminToken, roleController.list);
router.get("/:id", authAdminToken, roleController.getById);
router.post("/", authAdminToken, roleController.create);
router.put("/:id", authAdminToken, roleController.update);
router.delete("/:id", authAdminToken, roleController.remove);

export default router;
