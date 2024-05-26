import { Request, Response } from "express";
import TeamModel from "./teamModel";
import { size } from "lodash";
import { queryBuilder } from "../../helper/commonHelper";


const getTeams = async (req: Request, res: Response) => {
  try {
    const { filter , sort } = queryBuilder(req);
    const teams = await TeamModel.find({...filter}).sort(sort);
    res.status(200).json({
      data: {
        data: teams,
        meta: {
          total: size(teams),
        }
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const getTeamById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = await TeamModel.findById(id);
    res.status(200).json(role);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const createTeam = async (req: Request, res: Response) => {
    try {
      const role = await TeamModel.create(req.body);
      res.status(200).json(role);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
};

const updateTeam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const role = await TeamModel.findByIdAndUpdate(id, req.body);

    if (!role) {
      return res.status(404).json({ message: "Team not found" });
    }

    const updatedTeam = await TeamModel.findById(id);
    res.status(200).json(updatedTeam);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const deleteTeam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const role = await TeamModel.findByIdAndDelete(id);

    if (!role) {
      return res.status(404).json({ message: "Team not found" });
    }

    res.status(200).json({ message: "Team deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
};
