/**
 * Seeds the roles the app depends on and one admin user. Safe to re-run.
 *
 *   SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD='...' npm run seed
 *
 * The admin password is only set when the user is first created; re-running
 * never overwrites an existing admin's password.
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import connectDB from "../helper/dbconnect";
import RoleModel from "../modules/Role/roleModel";
import UserModel from "../modules/User/userModel";

const main = async () => {
  await connectDB();

  for (const [name, slug] of [
    ["Admin", "admin"],
    ["User", "user"],
  ]) {
    await RoleModel.updateOne({ slug }, { $setOnInsert: { name, slug } }, { upsert: true });
  }
  const adminRole = await RoleModel.findOne({ slug: "admin" });
  console.log("roles: ok");

  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password) {
    console.log("admin user: skipped (set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD to create one)");
    return;
  }
  if (password.length < 6) throw new Error("SEED_ADMIN_PASSWORD must be at least 6 characters");

  const existing = await UserModel.findOne({ username });
  if (existing) {
    if (String(existing.role) !== String(adminRole!._id)) {
      await UserModel.updateOne({ _id: existing._id }, { role: adminRole!._id });
      console.log(`admin user: '${username}' promoted to admin`);
    } else {
      console.log(`admin user: '${username}' already exists`);
    }
    return;
  }
  await UserModel.create({
    username,
    password: await bcrypt.hash(password, 10),
    fullname: process.env.SEED_ADMIN_FULLNAME || "Administrator",
    email: process.env.SEED_ADMIN_EMAIL || `${username}@example.com`,
    role: adminRole!._id,
  });
  console.log(`admin user: '${username}' created`);
};

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
