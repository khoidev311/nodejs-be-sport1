import express from "express"
import { authLogin, authRegister } from "./authController";

const router = express.Router();

router.post("/register", authRegister);
router.post("/login", authLogin);

export default router