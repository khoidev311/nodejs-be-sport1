import express from "express";
import { teamController } from "./teamController";
import { authAdminToken } from "../../middleware/authToken";

const router = express.Router();

router.get("/", teamController.list);
router.get("/:id", teamController.getById);
router.post("/", authAdminToken, teamController.create);
router.put("/:id", authAdminToken, teamController.update);
router.delete("/:id", authAdminToken, teamController.remove);

export default router;
