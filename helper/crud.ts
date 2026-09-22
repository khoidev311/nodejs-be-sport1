import { Request, Response } from "express";
import { Model, PopulateOptions } from "mongoose";
import { asyncHandler } from "./http";
import { paginate, queryBuilder } from "./commonHelper";
import { HttpError } from "./http";

interface CrudOptions {
  label: string; // used in messages, e.g. "Team"
  populate?: PopulateOptions[]; // applied to list and getById
  fields?: string[]; // whitelist for create/update; undefined = accept all body fields
}

const pickFields = (body: Record<string, unknown>, fields?: string[]) => {
  if (!fields) return body;
  const out: Record<string, unknown> = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
};

// Builds the standard list/getById/create/update/remove handlers for a model.
// Modules add their own handlers next to these when they need more.
const createCrudController = <T>(model: Model<T>, opts: CrudOptions) => {
  const { label, populate = [], fields } = opts;

  const list = asyncHandler(async (req: Request, res: Response) => {
    const { filter, sort, page, perPage } = queryBuilder(req);
    res.status(200).json(await paginate(model, filter, { page, perPage, sort, populate }));
  });

  const getById = asyncHandler(async (req: Request, res: Response) => {
    let query = model.findById(req.params.id);
    for (const p of populate) query = query.populate(p);
    const doc = await query.exec();
    if (!doc) throw new HttpError(404, `${label} not found`);
    res.status(200).json(doc);
  });

  const create = asyncHandler(async (req: Request, res: Response) => {
    const doc = await model.create(pickFields(req.body, fields));
    res.status(201).json(doc);
  });

  const update = asyncHandler(async (req: Request, res: Response) => {
    const doc = await model.findByIdAndUpdate(req.params.id, pickFields(req.body, fields), {
      new: true,
      runValidators: true,
    });
    if (!doc) throw new HttpError(404, `${label} not found`);
    res.status(200).json(doc);
  });

  const remove = asyncHandler(async (req: Request, res: Response) => {
    const doc = await model.findByIdAndDelete(req.params.id);
    if (!doc) throw new HttpError(404, `${label} not found`);
    res.status(200).json({ message: `${label} deleted successfully` });
  });

  return { list, getById, create, update, remove };
};

export { createCrudController };
