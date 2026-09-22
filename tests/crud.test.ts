import { describe, it, expect, beforeEach } from "vitest";
import { api, auth, seedAdmin } from "./helpers";

describe("crud (leagues/teams)", () => {
  let h: Record<string, string>;
  beforeEach(async () => {
    h = auth(await seedAdmin());
  });

  const createLeague = (name: string, logo = `${name}.png`) =>
    api.post("/api/leagues").set(h).send({ name, logo });

  it("creates with 201, strips unknown fields, and reads back a single object by id", async () => {
    const created = await createLeague("Premier League").send({
      name: "Premier League",
      logo: "pl.png",
      hacked: 1,
    });
    expect(created.status).toBe(201);
    expect(created.body).not.toHaveProperty("hacked");

    const byId = await api.get(`/api/leagues/${created.body._id}`);
    expect(byId.status).toBe(200);
    expect(byId.body._id).toBe(created.body._id);
    expect(byId.body).not.toHaveProperty("data");
  });

  it("maps errors: 400 bad id, 404 unknown, 400 validation, 409 duplicate", async () => {
    expect((await api.get("/api/leagues/not-an-id")).status).toBe(400);
    expect((await api.get("/api/leagues/000000000000000000000000")).status).toBe(404);
    expect((await api.post("/api/leagues").set(h).send({ name: "No logo" })).status).toBe(400);
    await createLeague("La Liga");
    const dup = await createLeague("La Liga", "other.png");
    expect(dup.status).toBe(409);
  });

  it("requires admin for writes and leaves reads public", async () => {
    expect((await api.post("/api/leagues").send({ name: "X", logo: "x.png" })).status).toBe(401);
    expect((await api.get("/api/leagues")).status).toBe(200);
  });

  it("paginates with a real total and clamps input", async () => {
    for (let i = 1; i <= 5; i++) await createLeague(`League ${i}`);
    const page2 = await api.get("/api/leagues?per_page=2&page=2&sort=name");
    expect(page2.status).toBe(200);
    expect(page2.body.meta).toEqual({ total: 5, current: 2, per_page: 2, pages: 3 });
    expect(page2.body.data.map((l: { name: string }) => l.name)).toEqual(["League 3", "League 4"]);

    expect((await api.get("/api/leagues?per_page=500")).status).toBe(400);
    expect((await api.get("/api/leagues?page=abc")).status).toBe(400);
    expect((await api.get("/api/leagues?sort=name;drop")).status).toBe(400);
  });

  it("filters case-insensitively and escapes regex metacharacters", async () => {
    await createLeague("Premier League");
    await createLeague("Serie A");
    const ci = await api.get("/api/leagues?filter[name]=premier");
    expect(ci.body.data.map((l: { name: string }) => l.name)).toEqual(["Premier League"]);
    const meta = await api.get("/api/leagues?filter[name]=(");
    expect(meta.status).toBe(200);
    expect(meta.body.meta.total).toBe(0);
  });

  it("updates in one call with validation and deletes with 404 on repeat", async () => {
    const { body: league } = await createLeague("PL");
    const upd = await api.put(`/api/leagues/${league._id}`).set(h).send({ name: "PL2" });
    expect(upd.status).toBe(200);
    expect(upd.body.name).toBe("PL2");
    expect((await api.put(`/api/leagues/${league._id}`).set(h).send({ name: "" })).status).toBe(400);
    expect((await api.delete(`/api/leagues/${league._id}`).set(h)).status).toBe(200);
    expect((await api.delete(`/api/leagues/${league._id}`).set(h)).status).toBe(404);
  });

  it("populates team.league on list and getById", async () => {
    const { body: league } = await createLeague("PL");
    const { body: team } = await api
      .post("/api/teams")
      .set(h)
      .send({ name: "A", logo: "a.png", league: league._id });
    const one = await api.get(`/api/teams/${team._id}`);
    expect(one.body.league.name).toBe("PL");
    const list = await api.get("/api/teams");
    expect(list.body.data[0].league.name).toBe("PL");
  });

  it("returns a JSON 404 for unknown routes and 400 for malformed JSON", async () => {
    const nf = await api.get("/api/nope");
    expect(nf.status).toBe(404);
    expect(nf.body.message).toMatch(/not found/);
    const bad = await api.post("/api/leagues").set(h).set("content-type", "application/json").send("{bad");
    expect(bad.status).toBe(400);
  });
});
