import express from "express"
import { createConfig, deleteConfig, getConfigById, getConfigs, updateConfig } from "./configController";
import { authAdminToken } from "../../middleware/authToken";

const router = express.Router();

router.get('/', getConfigs);
router.get("/:id", getConfigById);
router.post("/", authAdminToken,createConfig);
router.put("/:id", authAdminToken,updateConfig);
router.delete("/:id", authAdminToken,deleteConfig);

export default router
