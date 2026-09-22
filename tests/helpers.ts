import bcrypt from "bcryptjs";
import request from "supertest";
import app from "../src/app";
import RoleModel from "../modules/Role/roleModel";
import UserModel from "../modules/User/userModel";

export const api = request(app);

// Creates the admin/user roles and one admin; returns a bearer token for it.
export const seedAdmin = async () => {
  const [adminRole] = await Promise.all([
    RoleModel.create({ name: "Admin", slug: "admin" }),
    RoleModel.create({ name: "User", slug: "user" }),
  ]);
  await UserModel.create({
    username: "admin",
    password: await bcrypt.hash("admin123", 4),
    fullname: "Admin",
    email: "admin@example.com",
    role: adminRole._id,
  });
  const res = await api.post("/api/auth/login").send({ username: "admin", password: "admin123" });
  return res.body.access_token as string;
};

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
