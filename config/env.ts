import dotenv from "dotenv";

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
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "8h",
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || "7d",
};

export default env;
