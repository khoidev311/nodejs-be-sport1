import { Schema, model } from "mongoose";
import { addSourceIndex, sourceFields } from "../../helper/sourceFields";

const leagueSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    logo: { type: String, required: true },
    slug: { type: String },
    country: { type: String },
    // Source-side id of the current season (e.g. bongda tournament_id);
    // `external_id` holds the season-independent league id.
    season_external_id: { type: String },
    ...sourceFields,
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

addSourceIndex(leagueSchema);

const LeagueModel = model("League", leagueSchema);
export default LeagueModel;
