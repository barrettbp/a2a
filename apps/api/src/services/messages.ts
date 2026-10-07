import { stripHidden, systemMessages, type Lang } from "@snapwork/shared";
import { and, asc, desc, eq, gt, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { approvals, messages, rooms, seats } from "../db/schema";
import type { Room, Seat } from "../lib/auth";
import type { RoomEvent } from "../lib/bus";
import type { Deps } from "../lib/deps";
import { errors } from "../lib/errors";
import { isRoomGone } from "../lib/auth";
import { assertNoNul } from "../lib/validate";

type MessageRow = typeof messages.$inferSelect;
type ApprovalRow = typeof approvals.$inferSelect;

export const messageWire = (m: MessageRow) => ({
  id: m.id,
  seat_id: m.seatId,
  kind: m.kind,
  to_seat_id: m.toSeatId,
  body: m.body,
  meta: m.meta,
  created_at: m.createdAt.toISOString(),
});

export const approvalWire = (a: ApprovalRow) => ({
  id: a.id,
  agent_seat_id: a.agentSeatId,
  owner_seat_id: a.ownerSeatId,
  request_message_id: a.requestMessageId,
  task: a.task,
  plan: a.plan,
  status: a.status,
  note: a.note,
  decided_at: a.decidedAt?.toISOString() ?? null,
  created_at: a.createdAt.toISOString(),
});

/** State of one locked room inside a transaction. Events go out only after commit. */
export interface RoomCtx {
  tx: Db;
  room: Room;
  lang: Lang;
  added: number;
  events: RoomEvent[];
  paused: boolean;
  status: string;
}

export async function addMessage(
  c: RoomCtx,
  f: {
    seatId?: string | null;
    kind: "chat" | "system" | "approval_request" | "approval_decision" | "result";
    toSeatId?: string | null;
    body: string;
    meta?: Record<string, unknown>;
  },
): Promise<MessageRow> {
  const [row] = await c.tx
    .insert(messages)
    .values({
      roomId: c.room.id,
      seatId: f.seatId ?? null,
      kind: f.kind,
      toSeatId: f.toSeatId ?? null,
      body: f.body,
      meta: f.meta ?? {},
    })
    .returning();
  c.added++;
  c.events.push({ type: "message", id: row!.id, data: messageWire(row!) });
  return row!;
}

/**
 * Run `fn` with the room row locked. Every message insert goes through here, so ids
 * commit in order (the `after_id` cursor never skips a row) and the pause rule and the
 * message cap cannot race.
 */
export async function withRoomLock<T>(d: Deps, roomId: string, fn: (c: RoomCtx) => Promise<T>): Promise<T> {
  const events: RoomEvent[] = [];
  const result = await d.db.transaction(async (tx) => {
    const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for("update");
    if (!room || isRoomGone(room)) throw errors.gone();
    const c: RoomCtx = {
      tx: tx as unknown as Db,
      room,
      lang: room.lang as Lang,
      added: 0,
      events,
      paused: room.paused,
      status: room.status,
    };
    const out = await fn(c);
    if (c.status === "active" && room.messageCount + c.added >= d.limits.roomMaxMessages) {
      c.status = "readonly";
      await addMessage(c, { kind: "system", body: systemMessages.roomFull(c.lang) });
    }
    await tx
      .update(rooms)
      .set({
        messageCount: sql`${rooms.messageCount} + ${c.added}`,
        paused: c.paused,
        status: c.status,
      })
      .where(eq(rooms.id, roomId));
    return out;
  });
  for (const e of events) d.bus.emit(roomId, e);
  return result;
}

const SLASH = /^\/(approve|decline)(?:\s+([\s\S]*))?$/i;

/** Record a decision and post the structured approval_decision message. */
export async function applyDecision(
  c: RoomCtx,
  ap: ApprovalRow,
  status: "approved" | "declined",
  note: string | undefined,
): Promise<number> {
  const [updated] = await c.tx
    .update(approvals)
    .set({ status, note: note || null, decidedAt: new Date() })
    .where(eq(approvals.id, ap.id))
    .returning();
  const msg = await addMessage(c, {
    seatId: ap.ownerSeatId,
    kind: "approval_decision",
    toSeatId: ap.agentSeatId,
    body: `${status === "approved" ? "Approved" : "Declined"}: ${ap.task}${note ? `. ${note}` : ""}`,
    meta: { approval_id: ap.id, status, note: note || null },
  });
  c.events.push({ type: "approval", data: approvalWire(updated!) });
  c.paused = false;
  return msg.id;
}

export async function postMessage(
  d: Deps,
  seat: Seat,
  input: { body: string; toSeatId?: string | null },
): Promise<{ id: number }> {
  const body = stripHidden(input.body);
  if (body.length > d.limits.bodyMax) throw errors.bodyTooLong(d.limits.bodyMax);
  if (!body.trim()) throw errors.validation("Message is empty.");
  assertNoNul(body, "Message");
  if (!d.limiter.allow(`post:${seat.id}`, d.limits.postPerMin, 60_000)) throw errors.rateLimited();

  return withRoomLock(d, seat.roomId, async (c) => {
    if (c.status === "readonly") throw errors.readonly();
    const isAgent = seat.kind === "agent";
    if (isAgent && c.paused) throw errors.paused();

    if (input.toSeatId) {
      const [to] = await c.tx
        .select({ id: seats.id })
        .from(seats)
        .where(and(eq(seats.id, input.toSeatId), eq(seats.roomId, c.room.id)));
      if (!to) throw errors.validation("Unknown recipient.");
    }

    // Slash commands run only for human seats. For agents the text stays plain chat.
    const slash = isAgent ? null : SLASH.exec(body.trim());
    if (slash) {
      const [ap] = await c.tx
        .select()
        .from(approvals)
        .where(
          and(eq(approvals.roomId, c.room.id), eq(approvals.ownerSeatId, seat.id), eq(approvals.status, "pending")),
        )
        .limit(1)
        .for("update");
      if (!ap) {
        c.paused = false;
        const m = await addMessage(c, { kind: "system", body: systemMessages.nothingToApprove(c.lang) });
        return { id: m.id };
      }
      const id = await applyDecision(c, ap, slash[1]!.toLowerCase() === "approve" ? "approved" : "declined", slash[2]?.trim());
      return { id };
    }

    const msg = await addMessage(c, { seatId: seat.id, kind: "chat", toSeatId: input.toSeatId, body });
    if (!isAgent) {
      c.paused = false;
      return { id: msg.id };
    }

    // Pause rule: the last N non-system messages are all from agent seats.
    const last = await c.tx
      .select({ kind: seats.kind })
      .from(messages)
      .leftJoin(seats, eq(seats.id, messages.seatId))
      .where(and(eq(messages.roomId, c.room.id), ne(messages.kind, "system")))
      .orderBy(desc(messages.id))
      .limit(d.limits.pauseWindow);
    if (last.length === d.limits.pauseWindow && last.every((r) => r.kind === "agent")) {
      c.paused = true;
      await addMessage(c, { kind: "system", body: systemMessages.paused(c.lang) });
    }
    return { id: msg.id };
  });
}

export async function readMessages(
  db: Db,
  roomId: string,
  opts: { afterId?: number; limit?: number },
): Promise<{ messages: ReturnType<typeof messageWire>[]; last_id: number }> {
  const wanted = Number.isFinite(opts.limit) ? Math.floor(opts.limit!) : 50;
  const limit = Math.min(Math.max(wanted, 1), 200);
  let rows: MessageRow[];
  if (opts.afterId === undefined) {
    // No cursor: the latest page, oldest first.
    rows = (await db.select().from(messages).where(eq(messages.roomId, roomId)).orderBy(desc(messages.id)).limit(limit)).reverse();
  } else {
    rows = await db
      .select()
      .from(messages)
      .where(and(eq(messages.roomId, roomId), gt(messages.id, opts.afterId)))
      .orderBy(asc(messages.id))
      .limit(limit);
  }
  return { messages: rows.map(messageWire), last_id: rows.at(-1)?.id ?? opts.afterId ?? 0 };
}
