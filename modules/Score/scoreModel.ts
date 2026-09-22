import { Schema, model } from "mongoose";
import { addSourceIndex, sourceFields } from "../../helper/sourceFields";

const scoreSchema = new Schema(
  {
    host_team: { type: Schema.ObjectId, ref: "Team", required: true },
    guest_team: { type: Schema.ObjectId, ref: "Team", required: true },
    score: { type: String, required: true },
    league: { type: Schema.ObjectId, ref: "League", required: true },
    ...sourceFields,
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

scoreSchema.index({ league: 1 });
addSourceIndex(scoreSchema);

const ScoreModel = model("Score", scoreSchema);
export default ScoreModel;
