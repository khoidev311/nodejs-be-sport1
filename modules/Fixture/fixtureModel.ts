import { Schema, model } from "mongoose";

const fixtureSchema = new Schema(
  {
    host_team: { type: Schema.ObjectId, ref: "Team", required: true },
    guest_team: { type: Schema.ObjectId, ref: "Team", required: true },
    league: { type: Schema.ObjectId, ref: "League", required: true },
    // Pass the function, not its result, so each doc gets its own timestamp.
    start_time: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

const FixtureModel = model("Fixture", fixtureSchema);
export default FixtureModel;
