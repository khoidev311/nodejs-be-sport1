import bcrypt from "bcrypt";
import { Request, Response } from "express";
import UserModel from "../User/userModel";
import RoleModel from "../Role/roleModel";
import { issueTokens, verifyRefreshToken } from "../../helper/token";

const authRegister = async (req: Request, res: Response) => {
  try {
    // Only accept known fields — never let the client set role or _id.
    const { username, password, fullname, email } = req.body;
    if (!username || !password || !fullname || !email) {
      return res.status(400).json({ message: "username, password, fullname and email are required" });
    }
    const existing = await UserModel.findOne({ username });
    if (existing) {
      return res.status(422).json({ message: "Username already exists" });
    }
    const userRole = await RoleModel.findOne({ slug: "user" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      username,
      fullname,
      email,
      role: userRole?._id,
      password: hashedPassword,
    });
    return res.status(201).json(issueTokens(user._id.toString(), user.username));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const authLogin = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "username and password are required" });
    }
    const user = await UserModel.findOne({ username }).select("+password");
    // Same response for unknown user and wrong password: don't leak which one.
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    return res.status(200).json(issueTokens(user._id.toString(), user.username));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const authRefresh = async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ message: "refresh_token is required" });
    }
    let payload;
    try {
      payload = verifyRefreshToken(refresh_token);
    } catch {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }
    const user = await UserModel.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }
    return res.status(200).json(issueTokens(user._id.toString(), user.username));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// req.user is populated by the authenticate middleware.
const authGetMe = async (req: Request, res: Response) => {
  res.status(200).json(req.user);
};

export { authRegister, authLogin, authRefresh, authGetMe };
