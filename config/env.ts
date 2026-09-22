import dotenv from "dotenv";
import type { SignOptions } from "jsonwebtoken";

dotenv.config();

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const env = {
  port: Number(process.env.PORT || 3000),
  mongodbUri: required("MONGODB_URI"),
  accessTokenSecret: required("ACCESS_TOKEN_SECRET"),
  refreshTokenSecret: required("REFRESH_TOKEN_SECRET"),
  // ms-style durations, e.g. "8h", "7d"
  accessTokenTtl: (process.env.ACCESS_TOKEN_TTL || "8h") as SignOptions["expiresIn"],
  refreshTokenTtl: (process.env.REFRESH_TOKEN_TTL || "7d") as SignOptions["expiresIn"],
};

export default env;
