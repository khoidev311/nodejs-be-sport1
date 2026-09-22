import { describe, it, expect, beforeEach } from "vitest";
import { api, auth, seedAdmin } from "./helpers";

describe("fixtures / scores / ranks by league", () => {
  let h: Record<string, string>;
  let L1: string, L2: string, T1: string, T2: string, T3: string;

  beforeEach(async () => {
    h = auth(await seedAdmin());
    L1 = (await api.post("/api/leagues").set(h).send({ name: "L1", logo: "l1.png" })).body._id;
    L2 = (await api.post("/api/leagues").set(h).send({ name: "L2", logo: "l2.png" })).body._id;
    T1 = (await api.post("/api/teams").set(h).send({ name: "T1", logo: "t1.png", league: L1 })).body._id;
    T2 = (await api.post("/api/teams").set(h).send({ name: "T2", logo: "t2.png", league: L1 })).body._id;
    T3 = (await api.post("/api/teams").set(h).send({ name: "T3", logo: "t3.png", league: L2 })).body._id;
  });

  it("lists only the league's fixtures, populated and paginated", async () => {
    await api.post("/api/fixtures").set(h).send({ host_team: T1, guest_team: T2, league: L1 });
    await api.post("/api/fixtures").set(h).send({ host_team: T3, guest_team: T1, league: L2 });
    const res = await api.get(`/api/fixtures/league/${L1}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].host_team.name).toBe("T1");
    expect(res.body.data[0].league._id).toBe(L1);
  });

  it("gives each fixture its own start_time and accepts an explicit one", async () => {
    const a = await api.post("/api/fixtures").set(h).send({ host_team: T1, guest_team: T2, league: L1 });
    await new Promise((r) => setTimeout(r, 5));
    const b = await api.post("/api/fixtures").set(h).send({ host_team: T2, guest_team: T1, league: L1 });
    expect(a.body.start_time).not.toBe(b.body.start_time);
    const c = await api
      .post("/api/fixtures")
      .set(h)
      .send({ host_team: T1, guest_team: T2, league: L1, start_time: "2026-12-01T18:00:00Z" });
    expect(c.body.start_time).toBe("2026-12-01T18:00:00.000Z");
  });

  it("validates the score format", async () => {
    const ok = await api
      .post("/api/scores")
      .set(h)
      .send({ host_team: T1, guest_team: T2, league: L1, score: "2-1" });
    expect(ok.status).toBe(201);
    const bad = await api
      .post("/api/scores")
      .set(h)
      .send({ host_team: T1, guest_team: T2, league: L1, score: "two" });
    expect(bad.status).toBe(400);
  });

  it("orders the league table by rank, defaults history to [], and rejects a duplicate team", async () => {
    const r1 = await api.post("/api/ranks").set(h).send({ team: T1, league: L1, rank: 2 });
    expect(r1.body.history_match).toEqual([]);
    await api.post("/api/ranks").set(h).send({ team: T2, league: L1, rank: 1 });
    const table = await api.get(`/api/ranks/league/${L1}`);
    expect(
      table.body.data.map((r: { rank: number; team: { name: string } }) => [r.rank, r.team.name]),
    ).toEqual([
      [1, "T2"],
      [2, "T1"],
    ]);
    const dup = await api.post("/api/ranks").set(h).send({ team: T1, league: L1, rank: 3 });
    expect(dup.status).toBe(409);
    const badHist = await api
      .post("/api/ranks")
      .set(h)
      .send({ team: T3, league: L2, history_match: ["W", "X"] });
    expect(badHist.status).toBe(400);
  });
});
