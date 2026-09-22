import express from "express";
import { authGetMe, authLogin, authRefresh, authRegister } from "./authController";
import { authenticate } from "../../middleware/authToken";
import { validate } from "../../middleware/validate";
import { loginBody, refreshBody, registerBody } from "../../helper/schemas";

const router = express.Router();

router.post("/register", validate(registerBody), authRegister);
router.post("/login", validate(loginBody), authLogin);
router.post("/refresh", validate(refreshBody), authRefresh);
router.get("/me", authenticate, authGetMe);

export default router;
