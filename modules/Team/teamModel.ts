import { Schema, model } from "mongoose";
import { addSourceIndex, sourceFields } from "../../helper/sourceFields";

const teamSchema = new Schema(
  {
    name: { type: String, required: true },
    short_name: { type: String },
    logo: { type: String, required: true },
    // Primary (domestic) league. A team can still appear in fixtures of
    // other competitions; those reference it by _id.
    league: { type: Schema.ObjectId, ref: "League" },
    ...sourceFields,
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

teamSchema.index({ league: 1 });
teamSchema.index({ name: 1 });
addSourceIndex(teamSchema);

const TeamModel = model("Team", teamSchema);
export default TeamModel;
