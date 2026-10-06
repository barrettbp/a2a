import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { approvals, rooms, seats } from "../src/db/schema";
import { hashToken } from "../src/lib/tokens";
import { postMessage } from "../src/services/messages";
import { deleteExpiredRooms } from "../src/services/rooms";
import { bearer, makeApp, roomWithBoth } from "./helpers";

describe("create, claim, post, read", () => {
  it("runs the whole happy path", async () => {
    const { api } = await makeApp();
    const r = await roomWithBoth(api);

    expect(r.created.connect_prompt).toContain(`/mcp/${r.a.agent}`);
    expect(r.created.connect_prompt).toContain("the person you invite");
    expect(r.claimed.connect_prompt).toContain("Barrett");
    expect(r.a.owner.startsWith("own_")).toBe(true);
    expect(r.a.agent.startsWith("agt_")).toBe(true);

    const view = await api.get(`/rooms/${r.roomId}`).set(bearer(r.a.owner));
    expect(view.status).toBe(200);
    expect(view.body.seats).toHaveLength(4);
    expect(view.body.seats.every((s: object) => !("token_hash" in s) && !("tokenHash" in s))).toBe(true);
    expect(view.body.seats.every((s: { claimed: boolean }) => s.claimed)).toBe(true);
    expect(JSON.stringify(view.body)).not.toContain(hashToken(r.a.owner));

    const post = await api.post(`/rooms/${r.roomId}/messages`).set(bearer(r.a.owner)).send({ body: "Hello Minh" });
    expect(post.status).toBe(201);

    const read = await api.get(`/rooms/${r.roomId}/messages`).set(bearer(r.b.owner));
    const chat = read.body.messages.filter((m: { kind: string }) => m.kind === "chat");
    expect(chat).toHaveLength(1);
    expect(chat[0].body).toBe("Hello Minh");
    expect(read.body.messages[0].kind).toBe("system"); // "Minh joined the room."

    const after = await api.get(`/rooms/${r.roomId}/messages?after_id=${post.body.id}`).set(bearer(r.b.owner));
    expect(after.body.messages).toHaveLength(0);
    expect(after.body.last_id).toBe(post.body.id);
  });

  it("addresses a message to a seat and rejects a seat from another room", async () => {
    const { api } = await makeApp();
    const r = await roomWithBoth(api);
    const other = await roomWithBoth(api);
    const view = await api.get(`/rooms/${r.roomId}`).set(bearer(r.a.owner));
    const minh = view.body.seats.find((s: { name: string }) => s.name === "Minh");
    const ok = await api.post(`/rooms/${r.roomId}/messages`).set(bearer(r.a.owner)).send({ body: "hi", to_seat_id: minh.id });
    expect(ok.status).toBe(201);

    const otherView = await api.get(`/rooms/${other.roomId}`).set(bearer(other.a.owner));
    const foreign = await api
      .post(`/rooms/${r.roomId}/messages`)
      .set(bearer(r.a.owner))
      .send({ body: "hi", to_seat_id: otherView.body.me.seat_id });
    expect(foreign.status).toBe(400);
    expect(foreign.body.error.code).toBe("VALIDATION");
  });
});

describe("auth", () => {
  it("rejects missing, wrong and agent tokens with 401", async () => {
    const { api } = await makeApp();
    const r = await roomWithBoth(api);
    const url = `/rooms/${r.roomId}`;
    expect((await api.get(url)).status).toBe(401);
    expect((await api.get(url).set(bearer("own_" + "x".repeat(43)))).status).toBe(401);
    expect((await api.get(url).set(bearer(r.a.agent))).status).toBe(401);
    const res = await api.get(url).set("Authorization", "Basic abc");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("never treats the room id in the URL as proof of access", async () => {
    const { api } = await makeApp();
    const r1 = await roomWithBoth(api);
    const r2 = await roomWithBoth(api);
    const res = await api.get(`/rooms/${r2.roomId}/messages`).set(bearer(r1.a.owner));
    expect(res.status).toBe(401);
    const post = await api.post(`/rooms/${r2.roomId}/messages`).set(bearer(r1.a.owner)).send({ body: "x" });
    expect(post.status).toBe(401);
  });
});

describe("invites", () => {
  it("returns 410 on reuse, for preview and claim", async () => {
    const { api } = await makeApp();
    const r = await roomWithBoth(api);
    const prev = await api.get(`/invites/${r.inviteToken}`);
    expect(prev.status).toBe(410);
    expect(prev.body.error.message).toBe("This invite was already used.");
    const again = await api.post(`/invites/${r.inviteToken}/claim`).send({ name: "Eve" });
    expect(again.status).toBe(410);
  });

  it("previews an unused invite and 404s an unknown one", async () => {
    const { api } = await makeApp();
    const c = await api.post("/rooms").send({ name: "R", owner_name: "Barrett", lang: "vi" });
    const token = (c.body.invite_url as string).split("/i/")[1];
    const prev = await api.get(`/invites/${token}`);
    expect(prev.body).toEqual({ room_name: "R", inviter_name: "Barrett" });
    expect((await api.get("/invites/inv_nope")).status).toBe(404);
  });

  it("returns 410 'This room is gone.' when the room has expired", async () => {
    const { api, db } = await makeApp();
    const c = await api.post("/rooms").send({ name: "R", owner_name: "B", lang: "en" });
    const token = (c.body.invite_url as string).split("/i/")[1];
    await db.update(rooms).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(rooms.id, c.body.room_id));
    const prev = await api.get(`/invites/${token}`);
    expect(prev.status).toBe(410);
    expect(prev.body.error.message).toBe("This room is gone.");
  });

  it("lets only one of two simultaneous claims win", async () => {
    const { api } = await makeApp();
    const c = await api.post("/rooms").send({ name: "R", owner_name: "B", lang: "en" });
    const token = (c.body.invite_url as string).split("/i/")[1];
    const res = await Promise.all([
      api.post(`/invites/${token}/claim`).send({ name: "X" }),
      api.post(`/invites/${token}/claim`).send({ name: "Y" }),
    ]);
    expect(res.map((x) => x.status).sort()).toEqual([201, 410]);
  });
});

describe("validation and limits", () => {
  it("rejects a bad lang and an over-long body", async () => {
    const { api } = await makeApp();
    const bad = await api.post("/rooms").send({ name: "R", owner_name: "B", lang: "fr" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION");

    const r = await roomWithBoth(api);
    const long = await api.post(`/rooms/${r.roomId}/messages`).set(bearer(r.a.owner)).send({ body: "a".repeat(4001) });
    expect(long.status).toBe(400);
    expect(long.body.error.code).toBe("BODY_TOO_LONG");
    expect(long.body.error.message).toContain("4000");
    const blank = await api.post(`/rooms/${r.roomId}/messages`).set(bearer(r.a.owner)).send({ body: "   " });
    expect(blank.body.error.code).toBe("VALIDATION");
  });

  it("rate limits room creation per IP", async () => {
    const { api } = await makeApp({ limits: { createPerHour: 2 } });
    const body = { name: "R", owner_name: "B", lang: "en" };
    expect((await api.post("/rooms").send(body)).status).toBe(201);
    expect((await api.post("/rooms").send(body)).status).toBe(201);
    const third = await api.post("/rooms").send(body);
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe("RATE_LIMITED");
  });

  it("rate limits posts per seat", async () => {
    const { api } = await makeApp({ limits: { postPerMin: 2 } });
    const r = await roomWithBoth(api);
    const send = () => api.post(`/rooms/${r.roomId}/messages`).set(bearer(r.a.owner)).send({ body: "x" });
    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(429);
  });

  it("goes read-only at the message cap", async () => {
    const { api, db } = await makeApp();
    const r = await roomWithBoth(api);
    await db.update(rooms).set({ messageCount: 1998 }).where(eq(rooms.id, r.roomId));
    const send = (b: string) => api.post(`/rooms/${r.roomId}/messages`).set(bearer(r.a.owner)).send({ body: b });
    expect((await send("one")).status).toBe(201);
    expect((await send("two")).status).toBe(201);
    const blocked = await send("three");
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("ROOM_READONLY");
    const read = await api.get(`/rooms/${r.roomId}/messages`).set(bearer(r.a.owner));
    expect(read.status).toBe(200);
    expect(read.body.messages.at(-1).body).toContain("read-only");
    const [row] = await db.select().from(rooms).where(eq(rooms.id, r.roomId));
    expect(row!.status).toBe("readonly");
  });
});

async function seedApproval(db: Awaited<ReturnType<typeof makeApp>>["db"], roomId: string, agentSlot: 1 | 2) {
  const all = await db.select().from(seats).where(eq(seats.roomId, roomId));
  const agent = all.find((s) => s.kind === "agent" && s.slot === agentSlot)!;
  const [ap] = await db
    .insert(approvals)
    .values({ roomId, agentSeatId: agent.id, ownerSeatId: agent.ownerSeatId!, task: "Draft the proposal" })
    .returning();
  return { ap: ap!, agent };
}

describe("approvals", () => {
  it("lets only the owner decide, by REST", async () => {
    const { api, db } = await makeApp();
    const r = await roomWithBoth(api);
    const { ap } = await seedApproval(db, r.roomId, 2); // Minh's agent, owner is Minh
    const wrong = await api.post(`/approvals/${ap.id}/decide`).set(bearer(r.a.owner)).send({ status: "approved" });
    expect(wrong.status).toBe(403);
    const ok = await api.post(`/approvals/${ap.id}/decide`).set(bearer(r.b.owner)).send({ status: "approved", note: "go" });
    expect(ok.status).toBe(200);
    const msgs = await api.get(`/rooms/${r.roomId}/messages`).set(bearer(r.a.owner));
    const decision = msgs.body.messages.find((m: { kind: string }) => m.kind === "approval_decision");
    expect(decision.meta).toMatchObject({ approval_id: ap.id, status: "approved" });
    const twice = await api.post(`/approvals/${ap.id}/decide`).set(bearer(r.b.owner)).send({ status: "declined" });
    expect(twice.status).toBe(409);
  });

  it("does not find an approval from another room", async () => {
    const { api, db } = await makeApp();
    const r1 = await roomWithBoth(api);
    const r2 = await roomWithBoth(api);
    const { ap } = await seedApproval(db, r2.roomId, 1);
    const res = await api.post(`/approvals/${ap.id}/decide`).set(bearer(r1.a.owner)).send({ status: "approved" });
    expect(res.status).toBe(404);
  });

  it("runs /approve and /decline only for the owner's human seat", async () => {
    const { api, db } = await makeApp();
    const r = await roomWithBoth(api);
    const { ap } = await seedApproval(db, r.roomId, 2);
    const post = (t: string, b: string) => api.post(`/rooms/${r.roomId}/messages`).set(bearer(t)).send({ body: b });

    // The other human has nothing to approve; the approval stays pending.
    expect((await post(r.a.owner, "/approve")).status).toBe(201);
    let [row] = await db.select().from(approvals).where(eq(approvals.id, ap.id));
    expect(row!.status).toBe("pending");
    const msgs = await api.get(`/rooms/${r.roomId}/messages`).set(bearer(r.a.owner));
    expect(msgs.body.messages.at(-1)).toMatchObject({ kind: "system", body: "Nothing to approve right now." });

    // The owner declines with a note.
    expect((await post(r.b.owner, "/decline too risky")).status).toBe(201);
    [row] = await db.select().from(approvals).where(eq(approvals.id, ap.id));
    expect(row).toMatchObject({ status: "declined", note: "too risky" });
  });

  it("does not run slash commands for agent seats", async () => {
    const { api, db } = await makeApp();
    const r = await roomWithBoth(api);
    const { ap, agent } = await seedApproval(db, r.roomId, 2);
    await postMessage((await makeApp()).deps, agent, { body: "/approve" });
    const [row] = await db.select().from(approvals).where(eq(approvals.id, ap.id));
    expect(row!.status).toBe("pending");
    const msgs = await api.get(`/rooms/${r.roomId}/messages`).set(bearer(r.a.owner));
    expect(msgs.body.messages.at(-1)).toMatchObject({ kind: "chat", body: "/approve" });
  });
});

describe("pause rule", () => {
  it("pauses after 6 agent messages and a human message resumes", async () => {
    const { api, db, deps } = await makeApp();
    const r = await roomWithBoth(api);
    const all = await db.select().from(seats).where(eq(seats.roomId, r.roomId));
    const agents = all.filter((s) => s.kind === "agent");
    for (let i = 0; i < 6; i++) await postMessage(deps, agents[i % 2]!, { body: `m${i}` });

    const [paused] = await db.select().from(rooms).where(eq(rooms.id, r.roomId));
    expect(paused!.paused).toBe(true);
    await expect(postMessage(deps, agents[0]!, { body: "again" })).rejects.toMatchObject({
      code: "PAUSED_WAITING_FOR_HUMAN",
    });
    const msgs = await api.get(`/rooms/${r.roomId}/messages`).set(bearer(r.a.owner));
    const notices = msgs.body.messages.filter((m: { body: string }) => m.body.startsWith("Paused"));
    expect(notices).toHaveLength(1);

    await api.post(`/rooms/${r.roomId}/messages`).set(bearer(r.a.owner)).send({ body: "I am back" });
    const [resumed] = await db.select().from(rooms).where(eq(rooms.id, r.roomId));
    expect(resumed!.paused).toBe(false);
    await expect(postMessage(deps, agents[0]!, { body: "ok" })).resolves.toHaveProperty("id");
  });

  it("does not pause when a human spoke inside the window", async () => {
    const { api, db, deps } = await makeApp();
    const r = await roomWithBoth(api);
    const agents = (await db.select().from(seats).where(eq(seats.roomId, r.roomId))).filter((s) => s.kind === "agent");
    for (let i = 0; i < 3; i++) await postMessage(deps, agents[i % 2]!, { body: `m${i}` });
    await api.post(`/rooms/${r.roomId}/messages`).set(bearer(r.a.owner)).send({ body: "hi" });
    for (let i = 0; i < 5; i++) await postMessage(deps, agents[i % 2]!, { body: `n${i}` });
    const [row] = await db.select().from(rooms).where(eq(rooms.id, r.roomId));
    expect(row!.paused).toBe(false);
  });
});

describe("rotate token and expiry", () => {
  it("rotates the agent token for the owner only", async () => {
    const { api, db } = await makeApp();
    const r = await roomWithBoth(api);
    const all = await db.select().from(seats).where(eq(seats.roomId, r.roomId));
    const agentA = all.find((s) => s.kind === "agent" && s.slot === 1)!;

    const wrong = await api.post(`/seats/${agentA.id}/rotate-token`).set(bearer(r.b.owner));
    expect(wrong.status).toBe(403);

    const ok = await api.post(`/seats/${agentA.id}/rotate-token`).set(bearer(r.a.owner));
    expect(ok.status).toBe(200);
    expect(ok.body.agent_token).not.toBe(r.a.agent);
    expect(ok.body.connect_prompt).toContain(`/mcp/${ok.body.agent_token}`);
    const [row] = await db.select().from(seats).where(eq(seats.id, agentA.id));
    expect(row!.tokenHash).toBe(hashToken(ok.body.agent_token));
    expect(row!.tokenHash).not.toBe(hashToken(r.a.agent));
  });

  it("deletes expired rooms and everything under them", async () => {
    const { api, db } = await makeApp();
    const r = await roomWithBoth(api);
    await api.post(`/rooms/${r.roomId}/messages`).set(bearer(r.a.owner)).send({ body: "x" });
    const { ap } = await seedApproval(db, r.roomId, 1);
    await db.update(rooms).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(rooms.id, r.roomId));
    expect(await deleteExpiredRooms(db)).toBeGreaterThanOrEqual(1);
    expect(await db.select().from(seats).where(eq(seats.roomId, r.roomId))).toHaveLength(0);
    expect(await db.select().from(approvals).where(eq(approvals.id, ap.id))).toHaveLength(0);
    expect((await api.get(`/rooms/${r.roomId}`).set(bearer(r.a.owner))).status).toBe(401);
  });

  it("returns 410 for an owner token whose room expired but is not yet deleted", async () => {
    const { api, db } = await makeApp();
    const r = await roomWithBoth(api);
    await db.update(rooms).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(rooms.id, r.roomId));
    const res = await api.get(`/rooms/${r.roomId}`).set(bearer(r.a.owner));
    expect(res.status).toBe(410);
  });
});
