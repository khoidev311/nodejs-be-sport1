import { Schema, model } from "mongoose";

const scoreSchema = new Schema({
    host_team: {
        type: Schema.ObjectId,
        ref: 'Team',
      },
    guest_team: {
        type: Schema.ObjectId,
        ref: 'Team',
      },
    score:  {type: String, required: true },
    league: {
      type: Schema.ObjectId,
      ref: 'League',
    },
})

const ScoreModel = model("Score",scoreSchema);
export default ScoreModel;