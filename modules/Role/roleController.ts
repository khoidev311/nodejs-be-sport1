import RoleModel from "./roleModel";
import { createCrudController } from "../../helper/crud";

export const roleController = createCrudController(RoleModel, {
  label: "Role",
  fields: ["name", "slug"],
});
