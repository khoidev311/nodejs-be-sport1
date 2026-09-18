import express from "express";
import { authGetMe, authLogin, authRefresh, authRegister } from "./authController";
import { authenticate } from "../../middleware/authToken";

const router = express.Router();

router.post("/register", authRegister);
router.post("/login", authLogin);
router.post("/refresh", authRefresh);
router.get("/me", authenticate, authGetMe);

export default router;
