import express from "express";
import { configController } from "./configController";
import { authAdminToken } from "../../middleware/authToken";

const router = express.Router();

router.get("/", configController.list);
router.get("/:id", configController.getById);
router.post("/", authAdminToken, configController.create);
router.put("/:id", authAdminToken, configController.update);
router.delete("/:id", authAdminToken, configController.remove);

export default router;
