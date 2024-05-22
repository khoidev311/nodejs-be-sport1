import express from "express"
import { createRole, deleteRole, getRoleById, getRoles, updateRole } from "./roleController";
const router = express.Router();

router.get('/', getRoles);
router.get("/:id", getRoleById);
router.post("/", createRole);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);

export default router
