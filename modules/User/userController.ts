import { Request, Response } from "express";
import bcrypt from "bcrypt";
import UserModel from "./userModel";
import RoleModel from "../Role/roleModel";
import { createCrudController } from "../../helper/crud";
import { asyncHandler, HttpError } from "../../helper/http";

const populate = [{ path: "role", model: "Role" }];

// All user routes are admin-only, so admins may set `role` here. Self-service
// registration (Auth module) never accepts it.
const fields = ["fullname", "email", "username", "password", "role"];

const pickUserFields = (body: Record<string, unknown>) => {
  const data: Record<string, unknown> = {};
  for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
  return data;
};

const base = createCrudController(UserModel, { label: "User", populate, fields });

const createUser = asyncHandler(async (req: Request, res: Response) => {
  const data = pickUserFields(req.body);
  if (typeof data.password !== "string" || !data.password) {
    throw new HttpError(400, "password is required");
  }
  data.password = await bcrypt.hash(data.password, 10);
  if (data.role === undefined) {
    const userRole = await RoleModel.findOne({ slug: "user" });
    data.role = userRole?._id;
  }
  const user = await UserModel.create(data);
  res.status(201).json(user);
});

const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const data = pickUserFields(req.body);
  if (typeof data.password === "string" && data.password) {
    data.password = await bcrypt.hash(data.password, 10);
  } else {
    delete data.password;
  }
  const user = await UserModel.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!user) throw new HttpError(404, "User not found");
  res.status(200).json(user);
});

export const userController = { ...base, create: createUser, update: updateUser };
