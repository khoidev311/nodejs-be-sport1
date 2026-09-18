import { Schema, model } from "mongoose";

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
    team: { type: Schema.ObjectId, ref: "Team", required: true },
    league: { type: Schema.ObjectId, ref: "League", required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

const RankModel = model("Rank", rankSchema);
export default RankModel;
