import { Request } from "express";
import { FilterQuery, Model, PopulateOptions } from "mongoose";

const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 20;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v !== "") out[k] = v;
  }
  return out;
};

const clampInt = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

// Parses ?filter[field]=text&sort=-name&page=1&per_page=20 into query pieces.
// Filters are case-insensitive "contains" matches with regex metachars escaped.
const queryBuilder = (request: Request) => {
  const filterParams = toRecord(request.query?.filter);
  const filter: Record<string, RegExp> = {};
  for (const [field, value] of Object.entries(filterParams)) {
    filter[field] = new RegExp(escapeRegex(value), "i");
  }
  const sortParam = request.query?.sort;
  const sort = typeof sortParam === "string" && sortParam ? sortParam : undefined;
  return {
    filter,
    sort,
    page: clampInt(request.query?.page, 1, 1, Number.MAX_SAFE_INTEGER),
    perPage: clampInt(request.query?.per_page, DEFAULT_PER_PAGE, 1, MAX_PER_PAGE),
  };
};

interface PaginateOptions {
  page: number;
  perPage: number;
  sort?: string;
  populate?: PopulateOptions[];
}

// Runs a paginated find + countDocuments and returns the list envelope.
const paginate = async <T>(model: Model<T>, filter: FilterQuery<T>, opts: PaginateOptions) => {
  const { page, perPage, sort, populate = [] } = opts;
  let query = model.find(filter).skip((page - 1) * perPage).limit(perPage);
  if (sort) query = query.sort(sort);
  for (const p of populate) query = query.populate(p);
  const [data, total] = await Promise.all([query.exec(), model.countDocuments(filter)]);
  return {
    data,
    meta: {
      total,
      current: page,
      per_page: perPage,
      pages: Math.ceil(total / perPage),
    },
  };
};

export { queryBuilder, paginate, escapeRegex };
