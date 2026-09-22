import { Schema } from "mongoose";

// Provenance fields shared by every crawled collection. `external_id` is the
// id used by the source site; together with `source` it makes upserts
// idempotent. Manually created documents leave both unset.
export const SOURCES = ["manual", "bongda"] as const;
export type Source = (typeof SOURCES)[number];

export const sourceFields = {
  source: { type: String, enum: SOURCES, default: "manual" },
  external_id: { type: String },
};

export const addSourceIndex = (schema: Schema) => {
  schema.index(
    { source: 1, external_id: 1 },
    { unique: true, partialFilterExpression: { external_id: { $type: "string" } } },
  );
};
