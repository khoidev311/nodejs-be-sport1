import { Schema, model } from "mongoose";

const fixtureSchema = new Schema({
    host_team: {
        type: Schema.ObjectId,
        ref: 'Team',
      },
    guest_team: {
        type: Schema.ObjectId,
        ref: 'Team',
      },
    league: {
      type: Schema.ObjectId,
      ref: 'League',
    },
    start_time: { type: Date, default: Date.now() },
})

const FixtureModel = model("Fixture",fixtureSchema);
export default FixtureModel;