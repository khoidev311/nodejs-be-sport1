import express from "express";
import { createUser, deleteUser, getUserById, getUsers, updateUser } from "./userController";
import { authAdminToken } from "../../middleware/authToken";
const router = express.Router();

router.get('/',authAdminToken, getUsers);
router.get("/:id",authAdminToken, getUserById);
router.post("/", authAdminToken, createUser);
router.put("/:id",authAdminToken, updateUser);
router.delete("/:id",authAdminToken, deleteUser);

export default router
