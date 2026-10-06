import type { Approval, ApprovalStatus, Msg, RoomInfo, RoomSnapshot, Seat } from "../types";

export interface Pending {
  clientId: string;
  body: string;
  to_seat_id: string | null;
  seat_id: string;
  status: "sending" | "failed";
  /** error code when failed */
  error: string | null;
  createdAt: number;
}

export interface RoomState {
  loaded: boolean;
  room: RoomInfo | null;
  seats: Seat[];
  me: { seat_id: string; name: string } | null;
  /** confirmed server messages, ordered by id, unique */
  confirmed: Msg[];
  /** server message id -> client id of the optimistic item it replaced (keeps the React key stable) */
  clientIds: Record<number, string>;
  /** ids that arrived live in a small batch: they get the entrance animation */
  fresh: Record<number, true>;
  pending: Pending[];
  approvals: Record<string, Approval>;
}

export const initialState: RoomState = {
  loaded: false,
  room: null,
  seats: [],
  me: null,
  confirmed: [],
  clientIds: {},
  fresh: {},
  pending: [],
  approvals: {},
};

export type Action =
  | { type: "snapshot"; snap: RoomSnapshot }
  | { type: "history"; messages: Msg[] }
  | { type: "messages"; messages: Msg[]; live: boolean }
  | { type: "approval"; approval: Approval }
  | { type: "pendingAdd"; pending: Pending }
  | { type: "sent"; clientId: string; id: number }
  | { type: "failed"; clientId: string; error: string }
  | { type: "retry"; clientId: string }
  | { type: "discard"; clientId: string };

const MAX_ANIMATED_BATCH = 3;

function insertMessages(state: RoomState, incoming: Msg[]): Pick<RoomState, "confirmed" | "pending" | "clientIds"> & { added: Msg[] } {
  const known = new Set(state.confirmed.map((m) => m.id));
  const added: Msg[] = [];
  let pending = state.pending;
  let clientIds = state.clientIds;
  for (const m of [...incoming].sort((a, b) => a.id - b.id)) {
    if (known.has(m.id)) continue;
    known.add(m.id);
    added.push(m);
    if (m.kind === "chat" && state.me && m.seat_id === state.me.seat_id) {
      const i = pending.findIndex(
        (p) => p.status === "sending" && p.body === m.body && p.to_seat_id === m.to_seat_id,
      );
      if (i >= 0) {
        clientIds = { ...clientIds, [m.id]: pending[i]!.clientId };
        pending = pending.filter((_, j) => j !== i);
      }
    }
  }
  if (added.length === 0) return { confirmed: state.confirmed, pending, clientIds, added };
  const confirmed = [...state.confirmed, ...added];
  for (let i = 1; i < confirmed.length; i++) {
    if (confirmed[i - 1]!.id > confirmed[i]!.id) {
      confirmed.sort((a, b) => a.id - b.id);
      break;
    }
  }
  return { confirmed, pending, clientIds, added };
}

export function roomReducer(state: RoomState, a: Action): RoomState {
  switch (a.type) {
    case "snapshot": {
      const approvals = { ...state.approvals };
      for (const ap of a.snap.pending_approvals) approvals[ap.id] = ap;
      return { ...state, loaded: true, room: a.snap.room, seats: a.snap.seats, me: a.snap.me, approvals };
    }
    case "history": {
      const r = insertMessages(state, a.messages);
      return { ...state, confirmed: r.confirmed, pending: r.pending, clientIds: r.clientIds };
    }
    case "messages": {
      const r = insertMessages(state, a.messages);
      if (r.added.length === 0) return state;
      let fresh = state.fresh;
      if (a.live && r.added.length <= MAX_ANIMATED_BATCH) {
        fresh = { ...fresh };
        for (const m of r.added) fresh[m.id] = true;
      }
      return { ...state, confirmed: r.confirmed, pending: r.pending, clientIds: r.clientIds, fresh };
    }
    case "approval":
      return { ...state, approvals: { ...state.approvals, [a.approval.id]: a.approval } };
    case "pendingAdd":
      return { ...state, pending: [...state.pending, a.pending] };
    case "sent": {
      const p = state.pending.find((x) => x.clientId === a.clientId);
      if (!p) return state; // the SSE echo already merged it
      const exists = state.confirmed.some((m) => m.id === a.id);
      const rest = state.pending.filter((x) => x.clientId !== a.clientId);
      const clientIds = { ...state.clientIds, [a.id]: p.clientId };
      if (exists) return { ...state, pending: rest, clientIds };
      const msg: Msg = {
        id: a.id,
        seat_id: p.seat_id,
        kind: "chat",
        to_seat_id: p.to_seat_id,
        body: p.body,
        meta: {},
        created_at: new Date().toISOString(),
      };
      const r = insertMessages({ ...state, pending: [] }, [msg]);
      return { ...state, confirmed: r.confirmed, pending: rest, clientIds: { ...clientIds, ...r.clientIds, [a.id]: p.clientId } };
    }
    case "failed":
      return {
        ...state,
        pending: state.pending.map((p) => (p.clientId === a.clientId ? { ...p, status: "failed", error: a.error } : p)),
      };
    case "retry":
      return {
        ...state,
        pending: state.pending.map((p) => (p.clientId === a.clientId ? { ...p, status: "sending", error: null } : p)),
      };
    case "discard":
      return { ...state, pending: state.pending.filter((p) => p.clientId !== a.clientId) };
  }
}

export interface ApprovalView {
  id: string;
  status: ApprovalStatus;
  note: string | null;
  decidedAt: string | null;
  task: string;
  plan: string | null;
  agentSeatId: string | null;
  ownerSeatId: string | null;
  requestMessageId: number | null;
  resultMessageId: number | null;
}

/** Index structured approval facts out of the message log. Never reads message bodies. */
export function indexApprovalMessages(confirmed: Msg[]) {
  const decisions = new Map<string, Msg>();
  const results = new Map<string, Msg>();
  const requests = new Map<string, Msg>();
  for (const m of confirmed) {
    const id = typeof m.meta.approval_id === "string" ? m.meta.approval_id : null;
    if (!id) continue;
    if (m.kind === "approval_decision") decisions.set(id, m);
    else if (m.kind === "result") results.set(id, m);
    else if (m.kind === "approval_request") requests.set(id, m);
  }
  return { decisions, results, requests };
}

export type ApprovalIndex = ReturnType<typeof indexApprovalMessages>;

export function deriveApproval(approvalId: string, state: Pick<RoomState, "approvals">, idx: ApprovalIndex): ApprovalView {
  const ap = state.approvals[approvalId];
  const req = idx.requests.get(approvalId);
  const decision = idx.decisions.get(approvalId);
  const result = idx.results.get(approvalId);
  let status: ApprovalStatus = ap?.status ?? "pending";
  let note = ap?.note ?? null;
  let decidedAt = ap?.decided_at ?? null;
  const dStatus = decision?.meta.status;
  if (decision && (dStatus === "approved" || dStatus === "declined")) {
    status = dStatus;
    if (typeof decision.meta.note === "string") note = decision.meta.note;
    decidedAt = decidedAt ?? decision.created_at;
  }
  if (result) status = "done";
  return {
    id: approvalId,
    status,
    note,
    decidedAt,
    task: ap?.task ?? (typeof req?.meta.task === "string" ? req.meta.task : ""),
    plan: ap?.plan ?? (typeof req?.meta.plan === "string" ? req.meta.plan : null),
    agentSeatId: ap?.agent_seat_id ?? req?.seat_id ?? null,
    ownerSeatId: ap?.owner_seat_id ?? req?.to_seat_id ?? null,
    requestMessageId: req?.id ?? null,
    resultMessageId: result?.id ?? null,
  };
}
