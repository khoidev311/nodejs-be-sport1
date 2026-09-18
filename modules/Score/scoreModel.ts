import { Schema, model } from "mongoose";

const scoreSchema = new Schema(
  {
    host_team: { type: Schema.ObjectId, ref: "Team", required: true },
    guest_team: { type: Schema.ObjectId, ref: "Team", required: true },
    score: { type: String, required: true },
    league: { type: Schema.ObjectId, ref: "League", required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

const ScoreModel = model("Score", scoreSchema);
export default ScoreModel;
