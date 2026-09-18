import LeagueModel from "./leagueModel";
import { createCrudController } from "../../helper/crud";

export const leagueController = createCrudController(LeagueModel, {
  label: "League",
  fields: ["name", "logo"],
});
