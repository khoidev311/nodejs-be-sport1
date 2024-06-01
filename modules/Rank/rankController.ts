import { Request, Response } from "express";
import RankModel from "./rankModel";
import { size } from "lodash";
import { queryBuilder } from "../../helper/commonHelper";


const getRanks = async (req: Request, res: Response) => {
  try {
    const { filter , sort , page, perPage} = queryBuilder(req);
    const ranks = await RankModel.find({...filter}).sort(sort).populate({path:"team",model:"Team"}).populate({path:"league", model:"League"}).skip((Number(perPage) * Number(page) - Number(perPage))).limit(Number(perPage));
    res.status(200).json({
      data: ranks,
      meta: {
        total: size(ranks),
        current: page,
        pages: Math.ceil(size(ranks) / Number(perPage))
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const getRankById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = await RankModel.findById(id).populate({path:"team",model:"Team"}).populate({path:"league", model:"League"});
    res.status(200).json(role);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const getRankByLeagueId = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let scores = await RankModel.find({}).sort("rank").populate({path:"team",model:"Team"}).populate({path:"league", model:"League", match: {_id:id}});
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

const createRank = async (req: Request, res: Response) => {
    try {
      const role = await RankModel.create(req.body);
      res.status(200).json(role);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
};

const updateRank = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const role = await RankModel.findByIdAndUpdate(id, req.body);

    if (!role) {
      return res.status(404).json({ message: "Rank not found" });
    }

    const updatedRank = await RankModel.findById(id);
    res.status(200).json(updatedRank);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const deleteRank = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const role = await RankModel.findByIdAndDelete(id);

    if (!role) {
      return res.status(404).json({ message: "Rank not found" });
    }

    res.status(200).json({ message: "Rank deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export {
  getRanks,
  getRankById,
  getRankByLeagueId,
  createRank,
  updateRank,
  deleteRank,
};
