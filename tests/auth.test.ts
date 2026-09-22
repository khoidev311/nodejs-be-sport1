import { describe, it, expect, beforeEach } from "vitest";
import { api, auth, seedAdmin } from "./helpers";

const bob = { username: "bob", password: "secret1", fullname: "Bob", email: "bob@example.com" };

describe("auth", () => {
  let adminToken: string;
  beforeEach(async () => {
    adminToken = await seedAdmin();
  });

  it("registers, logs in and returns /me with the user role", async () => {
    const reg = await api.post("/api/auth/register").send({ ...bob, role: "000000000000000000000000" });
    expect(reg.status).toBe(201);
    expect(reg.body).toHaveProperty("access_token");

    const me = await api.get("/api/auth/me").set(auth(reg.body.access_token));
    expect(me.status).toBe(200);
    expect(me.body.username).toBe("bob");
    expect(me.body.role.slug).toBe("user"); // role from the request body was ignored
    expect(me.body).not.toHaveProperty("password");
  });

  it("rejects duplicate usernames with 422", async () => {
    await api.post("/api/auth/register").send(bob);
    const dup = await api.post("/api/auth/register").send(bob);
    expect(dup.status).toBe(422);
  });

  it("returns the same 401 for unknown user and wrong password", async () => {
    await api.post("/api/auth/register").send(bob);
    const wrongPw = await api.post("/api/auth/login").send({ username: "bob", password: "nope00" });
    const unknown = await api.post("/api/auth/login").send({ username: "nobody", password: "nope00" });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body).toEqual(unknown.body);
  });

  it("does not put the password in the refresh token", async () => {
    const reg = await api.post("/api/auth/register").send(bob);
    const payload = JSON.parse(Buffer.from(reg.body.refresh_token.split(".")[1], "base64url").toString());
    expect(payload).not.toHaveProperty("password");
    expect(payload.type).toBe("refresh");
  });

  it("refreshes with a refresh token but not with an access token", async () => {
    const reg = await api.post("/api/auth/register").send(bob);
    const ok = await api.post("/api/auth/refresh").send({ refresh_token: reg.body.refresh_token });
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveProperty("access_token");
    const bad = await api.post("/api/auth/refresh").send({ refresh_token: reg.body.access_token });
    expect(bad.status).toBe(401);
  });

  it("rejects missing, forged and tampered tokens with 401", async () => {
    expect((await api.get("/api/auth/me")).status).toBe(401);

    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const forged = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "1", username: "admin", type: "access" })}.`;
    expect((await api.get("/api/users").set(auth(forged))).status).toBe(401);

    const tampered = adminToken.slice(0, -2) + "xx";
    expect((await api.get("/api/users").set(auth(tampered))).status).toBe(401);
  });

  it("returns 403 for a non-admin on admin routes and 200 for admin", async () => {
    const reg = await api.post("/api/auth/register").send(bob);
    expect((await api.get("/api/users").set(auth(reg.body.access_token))).status).toBe(403);
    expect((await api.get("/api/users").set(auth(adminToken))).status).toBe(200);
  });

  it("validates the register body", async () => {
    const res = await api.post("/api/auth/register").send({ username: "ab", password: "123", email: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/username/);
    expect(res.body.message).toMatch(/password/);
    expect(res.body.message).toMatch(/email/);
  });
});
