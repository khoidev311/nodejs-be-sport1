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
})

const ScoreModel = model("Score",scoreSchema);
export default ScoreModel;