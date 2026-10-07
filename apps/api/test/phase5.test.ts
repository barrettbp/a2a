import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rooms } from "../src/db/schema";
import { supportsPrepared } from "../src/db/client";
import { RateLimiter } from "../src/lib/rateLimit";
import { startExpiryJob } from "../src/services/rooms";
import { bearer, makeApp, roomWithBoth } from "./helpers";

afterEach(() => vi.useRealTimers());

describe("CORS", () => {
  it("answers only for the configured web origin", async () => {
    const { api } = await makeApp();
    const evil = await api.get("/health").set("Origin", "https://evil.example");
    // The cors package sends the one configured origin. A browser compares it with the page origin and blocks the page.
    expect(evil.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(evil.headers["access-control-allow-origin"]).not.toBe("https://evil.example");
    expect(evil.headers["access-control-allow-origin"]).not.toBe("*");
    const none = await api.get("/health");
    expect(none.status).toBe(200);
  });

  it("allows the Authorization header in the preflight, and nothing wider than the web origin", async () => {
    const { api } = await makeApp();
    const r = await api
      .options("/rooms/r_x/messages")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");
    expect(r.status).toBe(204);
    expect(r.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(r.headers["access-control-allow-headers"]?.toLowerCase()).toContain("authorization");
    expect(r.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("does not leak the framework", async () => {
    const { api } = await makeApp();
    expect((await api.get("/health")).headers["x-powered-by"]).toBeUndefined();
  });
});

describe("rate limits", () => {
  it("limits invite claims per IP", async () => {
    const { api } = await makeApp({ limits: { claimPerHour: 2 } });
    const mk = async () => {
      const c = await api.post("/rooms").send({ name: "R", owner_name: "B", lang: "en" });
      return (c.body.invite_url as string).split("/i/")[1]!;
    };
    expect((await api.post(`/invites/${await mk()}/claim`).send({ name: "A" })).status).toBe(201);
    expect((await api.post(`/invites/${await mk()}/claim`).send({ name: "B" })).status).toBe(201);
    const third = await api.post(`/invites/${await mk()}/claim`).send({ name: "C" });
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe("RATE_LIMITED");
  });

  it("caps the number of tracked keys", () => {
    const l = new RateLimiter();
    for (let i = 0; i < RateLimiter.MAX_KEYS + 500; i++) l.allow(`k${i}`, 5, 3_600_000);
    const size = (l as unknown as { hits: Map<string, unknown> }).hits.size;
    expect(size).toBeLessThanOrEqual(RateLimiter.MAX_KEYS);
    // A key that is still tracked keeps counting.
    for (let i = 0; i < 5; i++) expect(l.allow("fresh", 5, 3_600_000)).toBe(true);
    expect(l.allow("fresh", 5, 3_600_000)).toBe(false);
  });
});

describe("expiry job", () => {
  it("runs hourly and deletes rooms that have expired", async () => {
    const { api, db } = await makeApp();
    const r = await roomWithBoth(api);
    await db.update(rooms).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(rooms.id, r.roomId));
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const errors: unknown[] = [];
    const t = startExpiryJob(db, (e) => errors.push(e));
    await vi.advanceTimersByTimeAsync(3_599_000);
    expect(await db.select().from(rooms).where(eq(rooms.id, r.roomId))).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2_000);
    vi.useRealTimers();
    await new Promise((x) => setTimeout(x, 300));
    expect(await db.select().from(rooms).where(eq(rooms.id, r.roomId))).toHaveLength(0);
    expect(errors).toEqual([]);
    clearInterval(t);
  });

  it("does not stop the process from exiting (timer is unref'd)", async () => {
    const { db } = await makeApp();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const t = startExpiryJob(db, () => {});
    expect((t as unknown as { hasRef: () => boolean }).hasRef?.() ?? false).toBe(false);
    clearInterval(t);
  });
});

describe("database url", () => {
  it("turns prepared statements off only for the transaction pooler port", () => {
    expect(supportsPrepared("postgresql://u:p@aws-0-ap.pooler.supabase.com:6543/postgres")).toBe(false);
    expect(supportsPrepared("postgresql://u:p@aws-0-ap.pooler.supabase.com:6543")).toBe(false);
    expect(supportsPrepared("postgresql://u:p@host:6543/postgres?sslmode=require")).toBe(false);
    expect(supportsPrepared("postgresql://u:p@aws-0-ap.pooler.supabase.com:5432/postgres")).toBe(true);
    expect(supportsPrepared("postgresql://u:p@db.abc.supabase.co:5432/postgres?sslmode=require")).toBe(true);
    expect(supportsPrepared("postgresql://u:p6543@host:5432/postgres")).toBe(true);
  });
});

describe("bearer helper sanity", () => {
  it("room routes still need a token after the dependency upgrades", async () => {
    const { api } = await makeApp();
    const r = await roomWithBoth(api);
    expect((await api.get(`/rooms/${r.roomId}`)).status).toBe(401);
    expect((await api.get(`/rooms/${r.roomId}`).set(bearer(r.a.owner))).status).toBe(200);
  });
});
