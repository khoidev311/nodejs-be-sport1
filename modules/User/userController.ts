
import { Request, Response } from "express";
import { queryBuilder } from "../../helper/commonHelper";
import UserModel from "./userModel";
import { size } from "lodash";
import bcrypt from "bcrypt";
import RoleModel from "../Role/roleModel";


const getUsers = async (req: Request, res: Response) => {
  try {
    const { filter , sort , page, perPage} = queryBuilder(req);
    const users = await UserModel.find({...filter}).sort(sort).populate({path:"role",model:"Role"}).skip((Number(perPage) * Number(page) - Number(perPage))).limit(Number(perPage));
    res.status(200).json({
      data: users,
      meta: {
        total: size(users),
        current: page,
        pages: Math.ceil(size(users) / Number(perPage))
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await UserModel.findById(id);
    res.status(200).json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const createUser = async (req: Request, res: Response) => {
    try {
      const hassedPasword = await bcrypt.hash(req.body.password,10);
      const userRole = await RoleModel.findOne({slug:"user"});
      const user = await UserModel.create({
        ...req.body,
        role: userRole?._id,
        password: hassedPasword
      });
      res.status(200).json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
};

const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await UserModel.findByIdAndUpdate(id, req.body);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = await UserModel.findById(id);
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

export {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
