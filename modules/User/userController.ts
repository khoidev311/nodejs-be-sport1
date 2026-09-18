import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { size } from "lodash";
import { queryBuilder } from "../../helper/commonHelper";
import UserModel from "./userModel";
import RoleModel from "../Role/roleModel";

// Fields a client is allowed to set. `role` is only settable by admins via
// updateUser (all user routes are admin-only), never on self-registration.
const pickUserFields = (body: Record<string, unknown>) => {
  const { fullname, email, username, password, role } = body;
  const data: Record<string, unknown> = {};
  if (fullname !== undefined) data.fullname = fullname;
  if (email !== undefined) data.email = email;
  if (username !== undefined) data.username = username;
  if (password !== undefined) data.password = password;
  if (role !== undefined) data.role = role;
  return data;
};

const getUsers = async (req: Request, res: Response) => {
  try {
    const { filter, sort, page, perPage } = queryBuilder(req);
    const users = await UserModel.find({ ...filter })
      .sort(sort)
      .populate({ path: "role", model: "Role" })
      .skip(Number(perPage) * Number(page) - Number(perPage))
      .limit(Number(perPage));
    res.status(200).json({
      data: users,
      meta: {
        total: size(users),
        current: page,
        pages: Math.ceil(size(users) / Number(perPage)),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await UserModel.findById(id).populate({ path: "role", model: "Role" });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const createUser = async (req: Request, res: Response) => {
  try {
    const data = pickUserFields(req.body);
    if (typeof data.password !== "string" || !data.password) {
      return res.status(400).json({ message: "password is required" });
    }
    data.password = await bcrypt.hash(data.password, 10);
    if (data.role === undefined) {
      const userRole = await RoleModel.findOne({ slug: "user" });
      data.role = userRole?._id;
    }
    const user = await UserModel.create(data);
    res.status(201).json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = pickUserFields(req.body);
    if (typeof data.password === "string" && data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    } else {
      delete data.password;
    }
    const updatedUser = await UserModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(updatedUser);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await UserModel.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export { getUsers, getUserById, createUser, updateUser, deleteUser };
