import { NextFunction, Request, Response } from "express";
import UserModel from "../modules/User/userModel";
import { extractBearer, verifyAccessToken } from "../helper/token";

// Verifies the Bearer access token, loads the user (with role) and attaches
// it to req.user. Rejects with 401 on missing/invalid/expired token.
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractBearer(req.headers["authorization"]);
  if (!token) {
    return res.status(401).json({ message: "Missing access token" });
  }
  try {
    const payload = verifyAccessToken(token);
    const user = await UserModel.findById(payload.sub).populate({ path: "role", model: "Role" });
    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }
    req.user = user;
    next();
  } catch (error: any) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
};

const requireRole =
  (slug: string) => (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role as { slug?: string } | undefined;
    if (role?.slug !== slug) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };

// Kept for existing routes: authenticate + admin role in one middleware chain.
const authAdminToken = [authenticate, requireRole("admin")];

export { authenticate, requireRole, authAdminToken };
