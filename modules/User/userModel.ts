import { model, Schema } from "mongoose";

const userSchema = new Schema(
  {
    fullname: { type: String, required: true },
    email: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, select: false, required: true },
    role: { type: Schema.ObjectId, ref: "Role" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

const UserModel = model("User", userSchema);
export default UserModel;
