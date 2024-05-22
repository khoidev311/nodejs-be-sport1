import { Schema, model } from "mongoose";

const roleSchema = new Schema(
    {
      name: {
        type: String,
        required: true,
        unique: true,
      },
      slug: {
        type: String,
      },
    }
  );
  const RoleModel = model("Role", roleSchema);
  export default RoleModel;