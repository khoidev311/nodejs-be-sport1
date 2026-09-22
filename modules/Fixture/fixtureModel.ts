import { Schema, model } from "mongoose";
import { addSourceIndex, sourceFields } from "../../helper/sourceFields";

export const FIXTURE_STATUSES = ["scheduled", "live", "finished", "postponed"] as const;

const fixtureSchema = new Schema(
  {
    host_team: { type: Schema.ObjectId, ref: "Team", required: true },
    guest_team: { type: Schema.ObjectId, ref: "Team", required: true },
    league: { type: Schema.ObjectId, ref: "League", required: true },
    // Pass the function, not its result, so each doc gets its own timestamp.
    start_time: { type: Date, default: Date.now },
    round: { type: Number },
    status: { type: String, enum: FIXTURE_STATUSES, default: "scheduled" },
    venue: { type: String },
    // Filled in once the match is finished (or live).
    home_score: { type: Number },
    away_score: { type: Number },
    ...sourceFields,
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

fixtureSchema.index({ league: 1, start_time: 1 });
fixtureSchema.index({ league: 1, round: 1 });
addSourceIndex(fixtureSchema);

const FixtureModel = model("Fixture", fixtureSchema);
export default FixtureModel;
