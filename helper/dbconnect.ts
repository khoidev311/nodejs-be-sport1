import mongoose from "mongoose";
import env from "../config/env";

// Cache the connection promise across invocations. On Vercel the module
// scope survives between warm requests, so this avoids reconnecting on
// every call while still being safe on a cold start.
let cached: Promise<typeof mongoose> | null = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!cached) {
    cached = mongoose
      .connect(env.mongodbUri, { serverSelectionTimeoutMS: 10000 })
      .then((conn) => {
        console.log("Connected to database!");
        return conn;
      })
      .catch((err) => {
        cached = null; // allow retry on next request
        throw err;
      });
  }
  return cached;
};

export default connectDB;
