import { INVISIBLE, UNSAFE_NAME_MESSAGE, cleanLine, greeting, isSafeName, rulesBlock, stripHidden, systemMessages } from "@snapwork/shared";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { approvals, messages, rooms, seats } from "../db/schema";
import type { Seat } from "../lib/auth";
import type { Deps } from "../lib/deps";
import { AppError, errors } from "../lib/errors";
import { assertCursor, assertNoNul, assertUuid } from "../lib/validate";
import { addMessage, approvalWire, messageWire, postMessage, readMessages, withRoomLock } from "./messages";

type Wire = ReturnType<typeof messageWire>;
type Role = "YOUR_OWNER" | "YOU" | "OTHER_HUMAN" | "OTHER_AGENT" | "SYSTEM";

const ONLINE_MS = 90_000;

// ---------- what agents see ----------

/** Wrap text from other participants. Any closing tag inside is neutralised first. */
export function wrapUntrusted(text: string): string {
  // NFKC folds fullwidth brackets; zero-width characters are dropped so the tag cannot be hidden.
  const folded = text.normalize("NFKC").replace(INVISIBLE, "");
  // Any closing-tag opener is broken too, so look-alike letters in the tag name cannot close the wrapper.
  const safe = folded
    .replace(/<\s*(\/?)\s*untrusted_message[^>]*>?/gi, "[$1untrusted_message]")
    // Every remaining "<" becomes a look-alike that cannot start a tag. Code and HTML sent between agents stay readable.
    .replace(/</g, "\u2039");
  return `<untrusted_message>${safe}</untrusted_message>`;
}

function roleOf(me: Seat, s: Seat): Role {
  if (s.id === me.id) return "YOU";
  if (s.id === me.ownerSeatId) return "YOUR_OWNER";
  return s.kind === "human" ? "OTHER_HUMAN" : "OTHER_AGENT";
}

const seatName = (s: Seat) => (s.kind === "human" ? s.displayName : s.agentName) ?? null;

/** Free text inside meta comes from other participants too, so it gets wrapped. */
function safeMeta(kind: string, meta: Record<string, unknown>): Record<string, unknown> {
  const out = { ...meta };
  const wrapField = (k: string) => {
    if (typeof out[k] === "string") out[k] = wrapUntrusted(out[k] as string);
  };
  if (kind === "approval_request") {
    wrapField("task");
    wrapField("plan");
  }
  if (kind === "approval_decision") wrapField("note");
  return out;
}

export function agentView(me: Seat, byId: Map<string, Seat>, m: Wire) {
  const from = m.seat_id ? byId.get(m.seat_id) : undefined;
  const to = m.to_seat_id ? byId.get(m.to_seat_id) : undefined;
  return {
    id: m.id,
    at: m.created_at,
    from: from
      ? { name: seatName(from), kind: from.kind, role: roleOf(me, from) }
      : { name: "Snapwork", kind: "system", role: "SYSTEM" as Role },
    to: !to ? "ALL" : to.id === me.id ? "YOU" : seatName(to),
    kind: m.kind,
    body: wrapUntrusted(m.body),
    meta: safeMeta(m.kind, m.meta),
  };
}

async function seatMap(d: Deps, roomId: string) {
  const all = await d.db.select().from(seats).where(eq(seats.roomId, roomId));
  return { all, byId: new Map(all.map((s) => [s.id, s])) };
}

// ---------- long-poll bookkeeping ----------

interface Waiter {
  superseded: boolean;
  woken: boolean;
  wake: () => void;
}

/** One open wait per agent seat. A new wait supersedes the old one and wakes it at once. */
export class WaiterRegistry {
  private map = new Map<string, Waiter>();

  open(seatId: string): Waiter {
    const prev = this.map.get(seatId);
    if (prev) {
      prev.superseded = true;
      prev.wake();
    }
    const w: Waiter = { superseded: false, woken: false, wake: () => {} };
    this.map.set(seatId, w);
    return w;
  }

  /** End any open wait for this seat (token rotation). */
  kill(seatId: string) {
    const w = this.map.get(seatId);
    if (w) {
      w.superseded = true;
      w.wake();
    }
  }

  close(seatId: string, w: Waiter) {
    if (this.map.get(seatId) === w) this.map.delete(seatId);
  }
}

function sleepUntilWoken(w: Waiter, ms: number): Promise<void> {
  if (w.woken) {
    w.woken = false;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      w.wake = () => {};
      w.woken = false;
      resolve();
    }
    w.wake = () => {
      w.woken = true;
      done();
    };
  });
}

// ---------- tools ----------

export const touch = (d: Deps, seat: Seat) =>
  d.db.update(seats).set({ lastSeenAt: new Date() }).where(eq(seats.id, seat.id));

export async function joinRoom(d: Deps, seat: Seat, input: { agent_name: string; model?: string }) {
  const requested = cleanLine(input.agent_name);
  if (requested.length < 1 || requested.length > 60) throw errors.validation("agent_name must be 1 to 60 characters.");
  if (!isSafeName(requested)) throw errors.validation(`agent_name: ${UNSAFE_NAME_MESSAGE}`);
  const model = input.model ? cleanLine(input.model) : undefined;
  if (model && model.length > 60) throw errors.validation("model must be at most 60 characters.");

  return withRoomLock(d, seat.roomId, async (c) => {
    const all = await c.tx.select().from(seats).where(eq(seats.roomId, c.room.id));
    const me = all.find((s) => s.id === seat.id)!;
    const owner = all.find((s) => s.id === me.ownerSeatId)!;
    const otherAgent = all.find((s) => s.kind === "agent" && s.id !== me.id);

    let name = requested;
    if (otherAgent?.agentName && otherAgent.agentName.toLowerCase() === name.toLowerCase()) name = `${name} (2)`;

    const now = new Date();
    const patch: Partial<typeof seats.$inferInsert> = {
      agentName: name,
      agentModel: model || me.agentModel,
      claimedAt: me.claimedAt ?? now,
      lastSeenAt: now,
    };
    if (!me.greetedAt && c.status !== "readonly") {
      await addMessage(c, {
        seatId: me.id,
        kind: "chat",
        body: greeting(c.lang, name, owner.displayName ?? "my owner"),
      });
      patch.greetedAt = now;
    }
    await c.tx.update(seats).set(patch).where(eq(seats.id, me.id));
    Object.assign(me, patch);
    c.events.push({ type: "seat", data: { reason: "joined", seat_id: me.id } });

    const byId = new Map(all.map((s) => [s.id, s]));
    const recent = (
      await c.tx.select().from(messages).where(eq(messages.roomId, c.room.id)).orderBy(desc(messages.id)).limit(20)
    ).reverse();
    // The greeting was inserted in this transaction, so it is part of `recent`.
    const views = recent.map((m) => agentView(me, byId, messageWire(m)));

    return {
      room: { id: c.room.id, name: c.room.name, lang: c.room.lang },
      you: { seat_id: me.id, agent_name: name, owner_name: owner.displayName },
      participants: all
        .sort((a, b) => (a.kind === b.kind ? a.slot - b.slot : a.kind === "human" ? -1 : 1))
        .map((s) => ({
          seat_id: s.id,
          kind: s.kind,
          name: seatName(s),
          role: roleOf(me, s),
          claimed: s.claimedAt !== null,
          online: s.lastSeenAt !== null && Date.now() - s.lastSeenAt.getTime() < ONLINE_MS,
        })),
      recent_messages: views,
      last_id: recent.at(-1)?.id ?? 0,
      instructions: rulesBlock(owner.displayName ?? "your owner"),
    };
  });
}

export async function waitForMessages(
  d: Deps,
  seat: Seat,
  input: { after_id: number; timeout_s?: number },
  signal?: AbortSignal,
) {
  assertCursor(input.after_id, "after_id");
  const wantedS = Number.isFinite(input.timeout_s) ? Math.floor(input.timeout_s!) : 25;
  const timeoutMs = Math.min(Math.max(wantedS, 1), 50) * 1000;
  const deadline = Date.now() + timeoutMs;
  const w = d.waiters.open(seat.id);
  const unsubscribe = d.bus.subscribe(seat.roomId, (e) => {
    if (e.type === "message") w.wake();
  });
  signal?.addEventListener("abort", () => w.wake());
  let cursor = input.after_id;

  try {
    for (;;) {
      if (w.superseded) return { messages: [], last_id: cursor, status: "superseded" as const };
      const rows = await d.db
        .select()
        .from(messages)
        .where(and(eq(messages.roomId, seat.roomId), gt(messages.id, cursor)))
        .orderBy(asc(messages.id))
        .limit(100);
      if (rows.length) {
        cursor = rows.at(-1)!.id;
        // Own messages move the cursor but are not echoed back.
        const others = rows.filter((r) => r.seatId !== seat.id);
        if (others.length) {
          const { byId } = await seatMap(d, seat.roomId);
          return {
            messages: others.map((m) => agentView(seat, byId, messageWire(m))),
            last_id: cursor,
            status: "messages" as const,
          };
        }
      }
      const left = deadline - Date.now();
      if (left <= 0 || signal?.aborted) break;
      await sleepUntilWoken(w, Math.min(1000, left));
    }
    const [room] = await d.db.select({ paused: rooms.paused }).from(rooms).where(eq(rooms.id, seat.roomId));
    return { messages: [], last_id: cursor, status: room?.paused ? ("paused" as const) : ("timeout" as const) };
  } finally {
    unsubscribe();
    d.waiters.close(seat.id, w);
  }
}

export async function readMessagesTool(d: Deps, seat: Seat, input: { after_id?: number; limit?: number }) {
  if (input.after_id !== undefined) assertCursor(input.after_id, "after_id");
  const out = await readMessages(d.db, seat.roomId, { afterId: input.after_id, limit: input.limit });
  const { byId } = await seatMap(d, seat.roomId);
  return { messages: out.messages.map((m) => agentView(seat, byId, m)), last_id: out.last_id };
}

export type Recipient = "owner" | "other_human" | "other_agent" | "all";

export async function postMessageTool(d: Deps, seat: Seat, input: { body: string; to?: Recipient }) {
  let toSeatId: string | null = null;
  if (input.to && input.to !== "all") {
    const { all } = await seatMap(d, seat.roomId);
    const target =
      input.to === "owner"
        ? all.find((s) => s.id === seat.ownerSeatId)
        : input.to === "other_human"
          ? all.find((s) => s.kind === "human" && s.id !== seat.ownerSeatId)
          : all.find((s) => s.kind === "agent" && s.id !== seat.id);
    if (!target) throw errors.validation("Unknown recipient.");
    if (!target.claimedAt) throw errors.validation("That participant has not joined yet.");
    toSeatId = target.id;
  }
  return postMessage(d, seat, { body: input.body, toSeatId });
}

export async function requestApproval(
  d: Deps,
  seat: Seat,
  input: { task: string; plan?: string; requested_by_message_id?: number },
) {
  const task = stripHidden(input.task).trim();
  const plan = input.plan ? stripHidden(input.plan).trim() || null : null;
  if (task.length < 1 || task.length > 500) throw errors.validation("task must be 1 to 500 characters.");
  if (plan && plan.length > 2000) throw errors.validation("plan must be at most 2000 characters.");
  assertNoNul(task, "task");
  assertNoNul(plan, "plan");
  if (input.requested_by_message_id !== undefined) assertCursor(input.requested_by_message_id, "requested_by_message_id");
  if (!d.limiter.allow(`approval:${seat.id}`, d.limits.approvalPerMin, 60_000)) throw errors.rateLimited();
  if (!seat.ownerSeatId) throw errors.validation("This seat has no owner.");

  return withRoomLock(d, seat.roomId, async (c) => {
    if (c.status === "readonly") throw errors.readonly();
    const [pending] = await c.tx
      .select({ id: approvals.id })
      .from(approvals)
      .where(and(eq(approvals.agentSeatId, seat.id), eq(approvals.status, "pending")))
      .limit(1);
    if (pending) {
      throw new AppError(
        "APPROVAL_PENDING",
        "You already have a pending approval. Wait for the decision first.",
        409,
      );
    }
    if (input.requested_by_message_id !== undefined) {
      const [ref] = await c.tx
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.id, input.requested_by_message_id), eq(messages.roomId, c.room.id)));
      if (!ref) throw errors.validation("requested_by_message_id is not a message in this room.");
    }

    const [ap] = await c.tx
      .insert(approvals)
      .values({ roomId: c.room.id, agentSeatId: seat.id, ownerSeatId: seat.ownerSeatId!, task, plan })
      .returning();
    const msg = await addMessage(c, {
      seatId: seat.id,
      kind: "approval_request",
      toSeatId: seat.ownerSeatId,
      body: task,
      meta: {
        approval_id: ap!.id,
        task,
        plan,
        ...(input.requested_by_message_id !== undefined ? { requested_by_message_id: input.requested_by_message_id } : {}),
      },
    });
    const [linked] = await c.tx
      .update(approvals)
      .set({ requestMessageId: msg.id })
      .where(eq(approvals.id, ap!.id))
      .returning();
    c.events.push({ type: "approval", data: approvalWire(linked!) });
    return { approval_id: ap!.id, status: "pending" as const };
  });
}

export async function checkApproval(d: Deps, seat: Seat, input: { approval_id: string }) {
  assertUuid(input.approval_id, "approval_id");
  const [ap] = await d.db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, input.approval_id), eq(approvals.agentSeatId, seat.id)));
  if (!ap) throw errors.notFound("Approval not found.");
  return { status: ap.status, note: ap.note, decided_at: ap.decidedAt?.toISOString() ?? null };
}

export async function reportDone(d: Deps, seat: Seat, rawInput: { approval_id: string; result: string }) {
  const input = { ...rawInput, result: stripHidden(rawInput.result) };
  if (input.result.length > d.limits.bodyMax) throw errors.bodyTooLong(d.limits.bodyMax);
  if (!input.result.trim()) throw errors.validation("result is empty.");
  assertNoNul(input.result, "result");
  assertUuid(input.approval_id, "approval_id");
  if (!d.limiter.allow(`post:${seat.id}`, d.limits.postPerMin, 60_000)) throw errors.rateLimited();

  return withRoomLock(d, seat.roomId, async (c) => {
    if (c.status === "readonly") throw errors.readonly();
    const [ap] = await c.tx
      .select()
      .from(approvals)
      .where(and(eq(approvals.id, input.approval_id), eq(approvals.agentSeatId, seat.id)))
      .for("update");
    if (!ap) throw errors.notFound("Approval not found.");
    if (ap.status !== "approved") {
      throw new AppError(
        "NOT_APPROVED",
        `This approval is ${ap.status}. You can only report done on an approved task.`,
        409,
      );
    }
    const msg = await addMessage(c, {
      seatId: seat.id,
      kind: "result",
      body: input.result,
      meta: { approval_id: ap.id },
    });
    const [done] = await c.tx.update(approvals).set({ status: "done" }).where(eq(approvals.id, ap.id)).returning();
    c.events.push({ type: "approval", data: approvalWire(done!) });
    return { id: msg.id };
  });
}

export async function leaveRoom(d: Deps, seat: Seat) {
  if (!d.limiter.allow(`leave:${seat.id}`, 3, 60_000)) throw errors.rateLimited();
  // `seat` was loaded before this call's own last-seen update, so null means it already left.
  const wasOnline = seat.lastSeenAt !== null;
  return withRoomLock(d, seat.roomId, async (c) => {
    await c.tx.update(seats).set({ lastSeenAt: null }).where(eq(seats.id, seat.id));
    if (wasOnline && c.status !== "readonly") {
      const [me] = await c.tx.select().from(seats).where(eq(seats.id, seat.id));
      await addMessage(c, { kind: "system", body: systemMessages.left(c.lang, me?.agentName ?? "Agent") });
    }
    c.events.push({ type: "seat", data: { reason: "left", seat_id: seat.id } });
    return { ok: true };
  });
}
