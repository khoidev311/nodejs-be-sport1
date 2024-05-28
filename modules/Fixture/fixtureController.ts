import { Request, Response } from "express";
import FixtureModel from "./fixtureModel";
import { size } from "lodash";
import { queryBuilder } from "../../helper/commonHelper";


const getFixtures = async (req: Request, res: Response) => {
  try {
    const { filter , sort } = queryBuilder(req);
    const scores = await FixtureModel.find({...filter}).sort(sort).populate({path:"host_team",model:"Team"}).populate({path:"guest_team",model:"Team"}).populate({path:"league", model:"League"});
    res.status(200).json({
        data: scores,
        meta: {
          total: size(scores),
        }
    });;
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const getFixtureById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = await FixtureModel.findById(id).populate({path:"host_team",model:"Team"}).populate({path:"guest_team",model:"Team"}).populate({path:"league", model:"League"});
    res.status(200).json(role);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const getFixtureByLeagueId = async (req: Request, res: Response) => {
  try {
    const { filter , sort } = queryBuilder(req);
    const { id } = req.params;
    let scores = await FixtureModel.find({...filter}).sort(sort).populate({path:"host_team",model:"Team"}).populate({path:"guest_team",model:"Team"}).populate({path:"league", model:"League", match: {_id:id}});
    scores = scores.filter((item)=> item.league !== null);
    res.status(200).json({
        data: scores,
        meta: {
          total: size(scores),
        }
    });;
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const createFixture = async (req: Request, res: Response) => {
    try {
      const role = await FixtureModel.create(req.body);
      res.status(200).json(role);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
};

const updateFixture = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const role = await FixtureModel.findByIdAndUpdate(id, req.body);

    if (!role) {
      return res.status(404).json({ message: "Fixture not found" });
    }

    const updatedFixture = await FixtureModel.findById(id);
    res.status(200).json(updatedFixture);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const deleteFixture = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const role = await FixtureModel.findByIdAndDelete(id);

    if (!role) {
      return res.status(404).json({ message: "Fixture not found" });
    }

    res.status(200).json({ message: "Fixture deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export {
  getFixtures,
  getFixtureById,
  getFixtureByLeagueId,
  createFixture,
  updateFixture,
  deleteFixture,
};
