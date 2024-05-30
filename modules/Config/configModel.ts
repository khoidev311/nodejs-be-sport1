import { Schema, model } from "mongoose";

const configSchema = new Schema(
    {
      key: {
        type: String,
        required: true,
        unique: true,
      },
      value: {
        type: String,
        required: true,
      },
    }
  );
  const ConfigModel = model("Config", configSchema);
  export default ConfigModel;