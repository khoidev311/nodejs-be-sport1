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
      }
})

const LeagueModel = model("League",teamSchema);
export default LeagueModel;