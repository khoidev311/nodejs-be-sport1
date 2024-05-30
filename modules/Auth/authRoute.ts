import express from "express"
import { authGetMe, authLogin, authRegister } from "./authController";

const router = express.Router();

router.post("/register", authRegister);
router.post("/login", authLogin);
router.get("/me", authGetMe)

export default router