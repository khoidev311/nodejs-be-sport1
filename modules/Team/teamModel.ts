import { Schema, model } from "mongoose";

const teamSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
      },
    logo: {
        type: String,
        required: true,
        unique: true,
      },
    league:{
        type: Schema.ObjectId,
        ref: 'League',
      },
})

const TeamModel = model("Team",teamSchema);
export default TeamModel;