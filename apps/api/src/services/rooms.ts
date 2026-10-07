import {
  connectPrompt,
  systemMessages,
  type ClaimInviteInput,
  type CreateRoomInput,
  type Lang,
} from "@snapwork/shared";
import { and, asc, eq, lt } from "drizzle-orm";
import type { Db } from "../db/client";
import { approvals, invites, rooms, seats } from "../db/schema";
import { isRoomGone, type Room, type Seat } from "../lib/auth";
import type { Deps } from "../lib/deps";
import { errors } from "../lib/errors";
import { assertUuid } from "../lib/validate";
import { generateRoomId, generateToken, hashToken } from "../lib/tokens";
import { addMessage, approvalWire, withRoomLock } from "./messages";

const DAY_MS = 24 * 3600 * 1000;

/** Seat as the web sees it. Never includes token hashes. */
export const seatWire = (s: Seat) => ({
  id: s.id,
  kind: s.kind,
  slot: s.slot,
  owner_seat_id: s.ownerSeatId,
  name: s.kind === "human" ? s.displayName : s.agentName,
  claimed: s.claimedAt !== null,
  last_seen_at: s.lastSeenAt?.toISOString() ?? null,
});

export async function createRoom(d: Deps, input: CreateRoomInput) {
  const roomId = generateRoomId();
  const ownerToken = generateToken("own");
  const agentToken = generateToken("agt");
  const inviteToken = generateToken("inv");
  const now = new Date();
  const agentName = input.agent_name ?? `${input.owner_name}'s agent`;

  await d.db.transaction(async (tx) => {
    await tx.insert(rooms).values({
      id: roomId,
      name: input.name,
      lang: input.lang,
      expiresAt: new Date(now.getTime() + d.limits.roomTtlDays * DAY_MS),
    });
    const [h1] = await tx
      .insert(seats)
      .values({
        roomId,
        kind: "human",
        slot: 1,
        displayName: input.owner_name,
        tokenHash: hashToken(ownerToken),
        claimedAt: now,
      })
      .returning();
    const [h2] = await tx.insert(seats).values({ roomId, kind: "human", slot: 2 }).returning();
    await tx.insert(seats).values({
      roomId,
      kind: "agent",
      slot: 1,
      ownerSeatId: h1!.id,
      agentName,
      tokenHash: hashToken(agentToken),
      claimedAt: now,
    });
    await tx.insert(seats).values({ roomId, kind: "agent", slot: 2, ownerSeatId: h2!.id });
    await tx.insert(invites).values({ roomId, humanSeatId: h2!.id, tokenHash: hashToken(inviteToken) });
  });

  return {
    room_id: roomId,
    owner_token: ownerToken,
    agent_token: agentToken,
    mcp_url: `${d.apiPublicUrl}/mcp/${agentToken}`,
    invite_url: `${d.webOrigin}/i/${inviteToken}`,
    connect_prompt: connectPrompt({
      roomName: input.name,
      ownerName: input.owner_name,
      otherName: null,
      agentName,
      agentToken,
      apiUrl: d.apiPublicUrl,
    }),
  };
}

async function findInvite(db: Db, token: string) {
  const [row] = await db
    .select({ invite: invites, room: rooms })
    .from(invites)
    .innerJoin(rooms, eq(rooms.id, invites.roomId))
    .where(eq(invites.tokenHash, hashToken(token)))
    .limit(1);
  if (!row) throw errors.notFound("Invite not found.");
  if (isRoomGone(row.room)) throw errors.gone("This room is gone.");
  return row;
}

export async function previewInvite(db: Db, token: string) {
  const { invite, room } = await findInvite(db, token);
  if (invite.usedAt) throw errors.gone("This invite was already used.");
  const [inviter] = await db
    .select()
    .from(seats)
    .where(and(eq(seats.roomId, room.id), eq(seats.kind, "human"), eq(seats.slot, 1)));
  return { room_name: room.name, inviter_name: inviter?.displayName ?? "Someone" };
}

export async function claimInvite(d: Deps, token: string, input: ClaimInviteInput) {
  const found = await findInvite(d.db, token);
  const roomId = found.room.id;
  const ownerToken = generateToken("own");
  const agentToken = generateToken("agt");
  const agentName = input.agent_name ?? `${input.name}'s agent`;

  const otherName = await withRoomLock(d, roomId, async (c) => {
    // Re-read under the room lock so two claims cannot both win.
    const [inv] = await c.tx.select().from(invites).where(eq(invites.id, found.invite.id)).for("update");
    if (!inv || inv.usedAt) throw errors.gone("This invite was already used.");
    const now = new Date();
    await c.tx.update(invites).set({ usedAt: now }).where(eq(invites.id, inv.id));
    await c.tx
      .update(seats)
      .set({ displayName: input.name, tokenHash: hashToken(ownerToken), claimedAt: now })
      .where(eq(seats.id, inv.humanSeatId));
    const [agent] = await c.tx
      .update(seats)
      .set({ agentName, tokenHash: hashToken(agentToken), claimedAt: now })
      .where(and(eq(seats.ownerSeatId, inv.humanSeatId), eq(seats.kind, "agent")))
      .returning();
    const [h1] = await c.tx
      .select()
      .from(seats)
      .where(and(eq(seats.roomId, roomId), eq(seats.kind, "human"), eq(seats.slot, 1)));
    await addMessage(c, { kind: "system", body: systemMessages.joined(c.lang, input.name) });
    c.events.push({ type: "seat", data: { reason: "claimed", seat_id: inv.humanSeatId } });
    if (agent) c.events.push({ type: "seat", data: { reason: "claimed", seat_id: agent.id } });
    return h1?.displayName ?? "the person who invited you";
  });

  return {
    room_id: roomId,
    owner_token: ownerToken,
    agent_token: agentToken,
    mcp_url: `${d.apiPublicUrl}/mcp/${agentToken}`,
    invite_url: null,
    connect_prompt: connectPrompt({
      roomName: found.room.name,
      ownerName: input.name,
      otherName,
      agentName,
      agentToken,
      apiUrl: d.apiPublicUrl,
    }),
  };
}

export async function getRoomView(db: Db, room: Room, me: Seat) {
  const roomSeats = await db.select().from(seats).where(eq(seats.roomId, room.id)).orderBy(asc(seats.kind), asc(seats.slot));
  const pending = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.roomId, room.id), eq(approvals.status, "pending")));
  return {
    room: {
      id: room.id,
      name: room.name,
      lang: room.lang as Lang,
      status: room.status,
      paused: room.paused,
      expires_at: room.expiresAt.toISOString(),
    },
    seats: roomSeats.map(seatWire),
    me: { seat_id: me.id, name: me.displayName },
    pending_approvals: pending.map(approvalWire),
  };
}

export async function rotateAgentToken(d: Deps, caller: Seat, agentSeatId: string) {
  assertUuid(agentSeatId, "seat id");
  const [agent] = await d.db
    .select()
    .from(seats)
    .where(and(eq(seats.id, agentSeatId), eq(seats.roomId, caller.roomId), eq(seats.kind, "agent")));
  if (!agent) throw errors.notFound("Seat not found.");
  if (agent.ownerSeatId !== caller.id) throw errors.forbidden("Only the owner can regenerate this token.");
  if (!agent.claimedAt) throw errors.validation("This seat is not claimed yet.", 409);

  const agentToken = generateToken("agt");
  await d.db.update(seats).set({ tokenHash: hashToken(agentToken) }).where(eq(seats.id, agent.id));

  const [room] = await d.db.select().from(rooms).where(eq(rooms.id, caller.roomId));
  const humans = await d.db.select().from(seats).where(and(eq(seats.roomId, caller.roomId), eq(seats.kind, "human")));
  const otherHuman = humans.find((h) => h.id !== caller.id && h.claimedAt);
  // A wait that started with the old token must not keep delivering after rotation.
  d.waiters.kill(agent.id);
  d.bus.emit(caller.roomId, { type: "seat", data: { reason: "rotated", seat_id: agent.id } });
  return {
    agent_token: agentToken,
    mcp_url: `${d.apiPublicUrl}/mcp/${agentToken}`,
    connect_prompt: connectPrompt({
      roomName: room!.name,
      ownerName: caller.displayName ?? "you",
      otherName: otherHuman?.displayName ?? null,
      agentName: agent.agentName ?? `${caller.displayName}'s agent`,
      agentToken,
      apiUrl: d.apiPublicUrl,
    }),
  };
}

/** Hourly job: delete rooms past expires_at. Seats, messages, invites, approvals cascade. */
export async function deleteExpiredRooms(db: Db): Promise<number> {
  const gone = await db.delete(rooms).where(lt(rooms.expiresAt, new Date())).returning({ id: rooms.id });
  return gone.length;
}

export function startExpiryJob(db: Db, onError: (e: unknown) => void) {
  const t = setInterval(() => deleteExpiredRooms(db).catch(onError), 3600 * 1000);
  t.unref();
  return t;
}
