import "./env";
import { afterAll, afterEach, beforeAll } from "vitest";
import mongoose from "mongoose";
import connectDB from "../helper/dbconnect";

beforeAll(async () => {
  await connectDB();
  // autoIndex builds in the background; unique-constraint tests need the
  // indexes to exist before the first insert.
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});

afterEach(async () => {
  // Keep tests independent: wipe every collection between tests.
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
