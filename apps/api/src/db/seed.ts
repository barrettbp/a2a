import { connectPrompt } from "@snapwork/shared";
import { loadEnv } from "../env";
import { generateRoomId, generateToken, hashToken } from "../lib/tokens";
import { createDb } from "./client";
import { invites, rooms, seats } from "./schema";

const env = loadEnv();
const { db, sql } = createDb(env.DATABASE_URL);

const roomId = generateRoomId();
const ownerToken = generateToken("own");
const agentToken = generateToken("agt");
const inviteToken = generateToken("inv");
const now = new Date();

await db.transaction(async (tx) => {
  await tx.insert(rooms).values({
    id: roomId,
    name: "Demo room",
    lang: "en",
    expiresAt: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
  });
  const [h1] = await tx
    .insert(seats)
    .values({ roomId, kind: "human", slot: 1, displayName: "Demo", tokenHash: hashToken(ownerToken), claimedAt: now })
    .returning();
  const [h2] = await tx.insert(seats).values({ roomId, kind: "human", slot: 2 }).returning();
  await tx.insert(seats).values({
    roomId,
    kind: "agent",
    slot: 1,
    ownerSeatId: h1!.id,
    agentName: "Demo's agent",
    tokenHash: hashToken(agentToken),
    claimedAt: now,
  });
  await tx.insert(seats).values({ roomId, kind: "agent", slot: 2, ownerSeatId: h2!.id });
  await tx.insert(invites).values({ roomId, humanSeatId: h2!.id, tokenHash: hashToken(inviteToken) });
});

await sql.end();

// Seed output is for local dev only. Tokens are printed once, like the real create flow.
console.log(`room:         ${env.WEB_ORIGIN}/r/${roomId}#${ownerToken}`);
console.log(`invite:       ${env.WEB_ORIGIN}/i/${inviteToken}`);
console.log(`agent token:  ${agentToken}`);
console.log("");
console.log(
  connectPrompt({
    roomName: "Demo room",
    ownerName: "Demo",
    otherName: null,
    agentName: "Demo's agent",
    agentToken,
    apiUrl: env.API_PUBLIC_URL,
  }),
);
