import { Request, Response } from "express";
import ConfigModel from "./configModel";
import { size } from "lodash";
import { queryBuilder } from "../../helper/commonHelper";


const getConfigs = async (req: Request, res: Response) => {
  try {
    const { filter , sort , page, perPage} = queryBuilder(req);
    const configs = await ConfigModel.find({...filter}).sort(sort).skip((Number(perPage) * Number(page) - Number(perPage))).limit(Number(perPage));
    res.status(200).json({
        data: configs,
        meta: {
          total: size(configs),
          current: page,
          pages: Math.ceil(size(configs) / Number(perPage))
        }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const getConfigById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const config = await ConfigModel.findById(id);
    res.status(200).json(config);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const createConfig = async (req: Request, res: Response) => {
    try {
      const config = await ConfigModel.create(req.body);
      res.status(200).json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
};

const updateConfig = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const config = await ConfigModel.findByIdAndUpdate(id, req.body);

    if (!config) {
      return res.status(404).json({ message: "Config not found" });
    }

    const updatedConfig = await ConfigModel.findById(id);
    res.status(200).json(updatedConfig);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const deleteConfig = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const config = await ConfigModel.findByIdAndDelete(id);

    if (!config) {
      return res.status(404).json({ message: "Config not found" });
    }

    res.status(200).json({ message: "Config deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export {
  getConfigs,
  getConfigById,
  createConfig,
  updateConfig,
  deleteConfig,
};
