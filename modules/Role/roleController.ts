import { Request, Response } from "express";
import RoleModel from "./roleModel";


const getRoles = async (req: Request, res: Response) => {
  try {
    const roles = await RoleModel.find({});
    res.status(200).json(roles);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const getRoleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = await RoleModel.findById(id);
    res.status(200).json(role);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const createRole = async (req: Request, res: Response) => {
    try {
      const role = await RoleModel.create(req.body);
      res.status(200).json(role);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
};

const updateRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const role = await RoleModel.findByIdAndUpdate(id, req.body);

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    const updatedRole = await RoleModel.findById(id);
    res.status(200).json(updatedRole);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const deleteRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const role = await RoleModel.findByIdAndDelete(id);

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.status(200).json({ message: "Role deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
};
