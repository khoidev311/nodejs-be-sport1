import { Schema, model } from "mongoose";
import { sourceFields } from "../../helper/sourceFields";

const rankSchema = new Schema(
  {
    win: { type: Number, default: 0 },
    lost: { type: Number, default: 0 },
    draw: { type: Number, default: 0 },
    efficiency: { type: Number, default: 0 },
    goal: { type: Number, default: 0 },
    rank: { type: Number, default: 0 },
    point: { type: Number, default: 0 },
    history_match: { type: [String], default: [] },
    total_match: { type: Number, default: 0 },
    goals_for: { type: Number, default: 0 },
    goals_against: { type: Number, default: 0 },
    goal_diff: { type: Number, default: 0 },
    team: { type: Schema.ObjectId, ref: "Team", required: true },
    league: { type: Schema.ObjectId, ref: "League", required: true },
    // Rank rows are keyed by { league, team }; no external_id needed.
    source: sourceFields.source,
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

rankSchema.index({ league: 1, rank: 1 });
rankSchema.index({ league: 1, team: 1 }, { unique: true });

const RankModel = model("Rank", rankSchema);
export default RankModel;
