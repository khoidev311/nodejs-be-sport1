import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import UserModel from "../User/userModel";
import RoleModel from "../Role/roleModel";
import { issueTokens, verifyRefreshToken } from "../../helper/token";
import { asyncHandler, HttpError } from "../../helper/http";

const authRegister = asyncHandler(async (req: Request, res: Response) => {
  // Only accept known fields — never let the client set role or _id.
  const { username, password, fullname, email } = req.body;
  if (!username || !password || !fullname || !email) {
    throw new HttpError(400, "username, password, fullname and email are required");
  }
  const existing = await UserModel.findOne({ username });
  if (existing) {
    throw new HttpError(422, "Username already exists");
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
  res.status(201).json(issueTokens(user._id.toString(), user.username));
});

const authLogin = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    throw new HttpError(400, "username and password are required");
  }
  const user = await UserModel.findOne({ username }).select("+password");
  // Same response for unknown user and wrong password: don't leak which one.
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new HttpError(401, "Invalid credentials");
  }
  res.status(200).json(issueTokens(user._id.toString(), user.username));
});

const authRefresh = asyncHandler(async (req: Request, res: Response) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    throw new HttpError(400, "refresh_token is required");
  }
  let payload;
  try {
    payload = verifyRefreshToken(refresh_token);
  } catch {
    throw new HttpError(401, "Invalid or expired refresh token");
  }
  const user = await UserModel.findById(payload.sub);
  if (!user) {
    throw new HttpError(401, "User no longer exists");
  }
  res.status(200).json(issueTokens(user._id.toString(), user.username));
});

// req.user is populated by the authenticate middleware.
const authGetMe = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(req.user);
});

export { authRegister, authLogin, authRefresh, authGetMe };
