import ConfigModel from "./configModel";
import { createCrudController } from "../../helper/crud";

export const configController = createCrudController(ConfigModel, {
  label: "Config",
  fields: ["key", "value"],
});
