import express from "express"
import { createRole, deleteRole, getRoleById, getRoles, updateRole } from "./roleController";
import { authAdminToken } from "../../middleware/authToken";
const router = express.Router();

router.get('/',authAdminToken, getRoles);
router.get("/:id",authAdminToken, getRoleById);
router.post("/", authAdminToken,createRole);
router.put("/:id",authAdminToken, updateRole);
router.delete("/:id",authAdminToken, deleteRole);

export default router
