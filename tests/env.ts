// Imported first by tests/setup.ts so it runs before any module that reads
// config/env.ts (ES imports are hoisted; module bodies run in import order).
// Each test file gets its own database so files can run in parallel.
const dbName = `sport1_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
process.env.MONGODB_URI = new URL(dbName, process.env.MONGODB_URI).toString();
