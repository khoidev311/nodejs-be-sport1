import TeamModel from "./teamModel";
import { createCrudController } from "../../helper/crud";

export const teamController = createCrudController(TeamModel, {
  label: "Team",
  populate: [{ path: "league", model: "League" }],
  fields: ["name", "logo", "league", "short_name", "aliases"],
});
