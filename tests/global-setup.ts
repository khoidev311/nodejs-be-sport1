import { MongoMemoryServer } from "mongodb-memory-server";

// Runs once in the main process before any worker starts. Workers are
// forked afterwards, so the env set here is inherited by every test file
// before config/env.ts is imported.
export default async function () {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
  process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
  return async () => {
    await mongod.stop();
  };
}
