import express from "express";
import { articleController, listArticles } from "./articleController";
import { authAdminToken } from "../../middleware/authToken";
import { validate } from "../../middleware/validate";
import { idParam, listQuery } from "../../helper/schemas";

// Read-only for clients; articles are written by the crawler.
const router = express.Router();

router.get("/", validate(listQuery, "query"), listArticles);
router.get("/:id", validate(idParam, "params"), articleController.getById);
router.delete("/:id", authAdminToken, validate(idParam, "params"), articleController.remove);

export default router;
