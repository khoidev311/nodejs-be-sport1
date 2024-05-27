import { Schema, model } from "mongoose";

const leagueSchema = new Schema({
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

const LeagueModel = model("League",leagueSchema);
export default LeagueModel;