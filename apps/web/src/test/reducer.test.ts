import { describe, expect, it } from "vitest";
import {
  deriveApproval,
  indexApprovalMessages,
  initialState,
  roomReducer,
  type Action,
  type Pending,
  type RoomState,
} from "../state/roomReducer";
import type { Approval, Msg } from "../types";

const ME = "seat-me";
const msg = (id: number, o: Partial<Msg> = {}): Msg => ({
  id,
  seat_id: "seat-other",
  kind: "chat",
  to_seat_id: null,
  body: `m${id}`,
  meta: {},
  created_at: "2026-10-06T10:00:00Z",
  ...o,
});
const run = (actions: Action[], s: RoomState = { ...initialState, me: { seat_id: ME, name: "Me" } }) =>
  actions.reduce(roomReducer, s);
const pend = (clientId: string, body: string, o: Partial<Pending> = {}): Pending => ({
  clientId,
  body,
  to_seat_id: null,
  seat_id: ME,
  status: "sending",
  error: null,
  createdAt: 0,
  ...o,
});

describe("roomReducer messages", () => {
  it("dedupes by id and keeps order by id", () => {
    const s = run([
      { type: "messages", messages: [msg(3), msg(1)], live: false },
      { type: "messages", messages: [msg(2), msg(3)], live: false },
      { type: "history", messages: [msg(1)] },
    ]);
    expect(s.confirmed.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it("marks small live batches as fresh, history and big batches not", () => {
    let s = run([{ type: "messages", messages: [msg(1)], live: true }]);
    expect(s.fresh[1]).toBe(true);
    s = run([{ type: "messages", messages: [msg(2), msg(3), msg(4), msg(5)], live: true }], s);
    expect(s.fresh[2]).toBeUndefined();
    s = run([{ type: "history", messages: [msg(9)] }], s);
    expect(s.fresh[9]).toBeUndefined();
  });
});

describe("optimistic send", () => {
  it("merges the SSE echo into the pending item and keeps its client id", () => {
    const s = run([
      { type: "pendingAdd", pending: pend("c1", "hello") },
      { type: "messages", messages: [msg(10, { seat_id: ME, body: "hello" })], live: true },
    ]);
    expect(s.pending).toHaveLength(0);
    expect(s.confirmed.map((m) => m.id)).toEqual([10]);
    expect(s.clientIds[10]).toBe("c1");
  });

  it("the POST response converts pending to confirmed when no echo came", () => {
    const s = run([
      { type: "pendingAdd", pending: pend("c1", "hello") },
      { type: "sent", clientId: "c1", id: 11 },
    ]);
    expect(s.pending).toHaveLength(0);
    expect(s.confirmed[0]).toMatchObject({ id: 11, body: "hello", seat_id: ME });
    expect(s.clientIds[11]).toBe("c1");
  });

  it("a later echo of the same id does not duplicate", () => {
    const s = run([
      { type: "pendingAdd", pending: pend("c1", "hello") },
      { type: "sent", clientId: "c1", id: 11 },
      { type: "messages", messages: [msg(11, { seat_id: ME, body: "hello" })], live: true },
    ]);
    expect(s.confirmed).toHaveLength(1);
  });

  it("echo then POST response: sent is a no-op", () => {
    const s = run([
      { type: "pendingAdd", pending: pend("c1", "hello") },
      { type: "messages", messages: [msg(12, { seat_id: ME, body: "hello" })], live: true },
      { type: "sent", clientId: "c1", id: 12 },
    ]);
    expect(s.confirmed).toHaveLength(1);
    expect(s.pending).toHaveLength(0);
    expect(s.clientIds[12]).toBe("c1");
  });

  it("two identical bodies match in send order", () => {
    const s = run([
      { type: "pendingAdd", pending: pend("c1", "hi") },
      { type: "pendingAdd", pending: pend("c2", "hi") },
      { type: "messages", messages: [msg(20, { seat_id: ME, body: "hi" })], live: true },
    ]);
    expect(s.clientIds[20]).toBe("c1");
    expect(s.pending.map((p) => p.clientId)).toEqual(["c2"]);
  });

  it("does not merge someone else's message with the same body", () => {
    const s = run([
      { type: "pendingAdd", pending: pend("c1", "hi") },
      { type: "messages", messages: [msg(5, { body: "hi" })], live: true },
    ]);
    expect(s.pending).toHaveLength(1);
  });

  it("failed, retry and discard", () => {
    let s = run([
      { type: "pendingAdd", pending: pend("c1", "x") },
      { type: "failed", clientId: "c1", error: "RATE_LIMITED" },
    ]);
    expect(s.pending[0]).toMatchObject({ status: "failed", error: "RATE_LIMITED" });
    s = run([{ type: "retry", clientId: "c1" }], s);
    expect(s.pending[0]).toMatchObject({ status: "sending", error: null });
    s = run([{ type: "discard", clientId: "c1" }], s);
    expect(s.pending).toHaveLength(0);
  });

  it("a failed item is not merged by an echo", () => {
    const s = run([
      { type: "pendingAdd", pending: pend("c1", "x", { status: "failed", error: "NETWORK" }) },
      { type: "messages", messages: [msg(3, { seat_id: ME, body: "x" })], live: true },
    ]);
    expect(s.pending).toHaveLength(1);
  });
});

describe("approvals", () => {
  const ap = (status: Approval["status"], o: Partial<Approval> = {}): Approval => ({
    id: "a1",
    agent_seat_id: "ag",
    owner_seat_id: ME,
    request_message_id: 1,
    task: "Draft it",
    plan: null,
    status,
    note: null,
    decided_at: null,
    created_at: "2026-10-06T10:00:00Z",
    ...o,
  });
  const req = msg(1, { kind: "approval_request", seat_id: "ag", to_seat_id: ME, meta: { approval_id: "a1", task: "Draft it" } });

  it("upserts approvals from events", () => {
    const s = run([
      { type: "approval", approval: ap("pending") },
      { type: "approval", approval: ap("approved", { decided_at: "2026-10-06T10:01:00Z" }) },
    ]);
    expect(s.approvals.a1?.status).toBe("approved");
  });

  it("derives status from structured meta, not from body text", () => {
    const decision = msg(2, { kind: "approval_decision", body: "declined", meta: { approval_id: "a1", status: "approved", note: "go" } });
    const s = run([{ type: "history", messages: [req, decision] }]);
    const v = deriveApproval("a1", s, indexApprovalMessages(s.confirmed));
    expect(v.status).toBe("approved");
    expect(v.note).toBe("go");
    expect(v.task).toBe("Draft it");
  });

  it("a result message makes it done", () => {
    const result = msg(3, { kind: "result", meta: { approval_id: "a1" } });
    const s = run([{ type: "history", messages: [req, result] }, { type: "approval", approval: ap("approved") }]);
    const v = deriveApproval("a1", s, indexApprovalMessages(s.confirmed));
    expect(v.status).toBe("done");
    expect(v.resultMessageId).toBe(3);
  });

  it("an unknown approval defaults to pending", () => {
    const s = run([{ type: "history", messages: [req] }]);
    expect(deriveApproval("a1", s, indexApprovalMessages(s.confirmed)).status).toBe("pending");
  });
});
