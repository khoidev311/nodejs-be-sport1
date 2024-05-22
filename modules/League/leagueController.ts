import { Request, Response } from "express";
import LeagueModel from "./leagueModel";


const getLeagues = async (req: Request, res: Response) => {
  try {
    const roles = await LeagueModel.find({});
    res.status(200).json(roles);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const getLeagueById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = await LeagueModel.findById(id);
    res.status(200).json(role);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const createLeague = async (req: Request, res: Response) => {
    try {
      const role = await LeagueModel.create(req.body);
      res.status(200).json(role);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
};

const updateLeague = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const role = await LeagueModel.findByIdAndUpdate(id, req.body);

    if (!role) {
      return res.status(404).json({ message: "League not found" });
    }

    const updatedLeague = await LeagueModel.findById(id);
    res.status(200).json(updatedLeague);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const deleteLeague = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const role = await LeagueModel.findByIdAndDelete(id);

    if (!role) {
      return res.status(404).json({ message: "League not found" });
    }

    res.status(200).json({ message: "League deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export {
  getLeagues,
  getLeagueById,
  createLeague,
  updateLeague,
  deleteLeague,
};
