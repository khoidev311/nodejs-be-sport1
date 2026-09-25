import { model, Schema } from "mongoose";

const userSchema = new Schema(
  {
    fullname: { type: String, required: true },
    email: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, select: false, required: true },
    role: { type: Schema.ObjectId, ref: "Role" },
    favorite_teams: { type: [{ type: Schema.ObjectId, ref: "Team" }], default: [] },
    // Expo push tokens, one per device (capped at MAX_PUSH_TOKENS).
    push_tokens: {
      type: [
        {
          _id: false,
          token: { type: String, required: true },
          platform: { type: String, enum: ["ios", "android"] },
          updated_at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    // Push tokens are device identifiers; never echo them back (e.g. /auth/me).
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.push_tokens;
        return ret;
      },
    },
  },
);

export const MAX_PUSH_TOKENS = 5;

userSchema.index({ favorite_teams: 1 });
userSchema.index({ "push_tokens.token": 1 });

const UserModel = model("User", userSchema);
export default UserModel;
