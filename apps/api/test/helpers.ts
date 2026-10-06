import { expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/db/client";
import { createApp, type AppOptions } from "../src/app";

let shared: Db | undefined;

/** One in-memory Postgres per test file. Tests make their own rooms. */
export async function testDb(): Promise<Db> {
  if (shared) return shared;
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  return (shared = db as unknown as Db);
}

export async function makeApp(over: Partial<AppOptions> = {}) {
  const db = await testDb();
  const made = createApp({
    db,
    webOrigin: "http://localhost:5173",
    apiPublicUrl: "http://api.test",
    limits: { createPerHour: 1000, claimPerHour: 1000, postPerMin: 1000 },
    ...over,
  });
  return { ...made, db, api: request(made.app) };
}

export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

/** Create a room and claim the invite. Returns both sides' tokens. */
export async function roomWithBoth(api: ReturnType<typeof request>, lang: "en" | "vi" = "en") {
  const c = await api.post("/rooms").send({ name: "Test room", owner_name: "Barrett", lang });
  expect(c.status).toBe(201);
  const inviteToken = (c.body.invite_url as string).split("/i/")[1]!;
  const k = await api.post(`/invites/${inviteToken}/claim`).send({ name: "Minh", agent_name: "Minh Bot" });
  expect(k.status).toBe(201);
  return {
    roomId: c.body.room_id as string,
    inviteToken,
    a: { owner: c.body.owner_token as string, agent: c.body.agent_token as string },
    b: { owner: k.body.owner_token as string, agent: k.body.agent_token as string },
    created: c.body,
    claimed: k.body,
  };
}
