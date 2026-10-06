import { API_URL } from "./config";
import type { Approval, CreateResult, Msg, RoomSnapshot } from "./types";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
  get isNetwork() {
    return this.status === 0;
  }
}

interface Opts {
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, o: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (o.token) headers.Authorization = `Bearer ${o.token}`;
  if (o.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: o.method ?? "GET",
      headers,
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
      signal: o.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "NETWORK", "Couldn't reach Snapwork.");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "INTERNAL", err?.message ?? `Request failed (${res.status}).`);
  }
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  createRoom: (body: { name: string; owner_name: string; agent_name?: string; lang: "en" | "vi" }) =>
    request<CreateResult>("/rooms", { method: "POST", body }),
  getInvite: (token: string, signal?: AbortSignal) =>
    request<{ room_name: string; inviter_name: string }>(`/invites/${enc(token)}`, { signal }),
  claimInvite: (token: string, body: { name: string; agent_name?: string }) =>
    request<CreateResult>(`/invites/${enc(token)}/claim`, { method: "POST", body }),
  getRoom: (roomId: string, token: string, signal?: AbortSignal) =>
    request<RoomSnapshot>(`/rooms/${enc(roomId)}`, { token, signal }),
  getMessages: (roomId: string, token: string, afterId?: number, signal?: AbortSignal) =>
    request<{ messages: Msg[]; last_id: number }>(
      `/rooms/${enc(roomId)}/messages${afterId ? `?after_id=${afterId}&limit=200` : "?limit=50"}`,
      { token, signal },
    ),
  postMessage: (roomId: string, token: string, body: string, toSeatId?: string) =>
    request<{ id: number }>(`/rooms/${enc(roomId)}/messages`, {
      method: "POST",
      token,
      body: toSeatId ? { body, to_seat_id: toSeatId } : { body },
    }),
  decide: (token: string, approvalId: string, status: "approved" | "declined") =>
    request<{ message_id: number }>(`/approvals/${enc(approvalId)}/decide`, {
      method: "POST",
      token,
      body: { status },
    }),
  rotateToken: (token: string, agentSeatId: string) =>
    request<{ agent_token: string; connect_prompt: string }>(`/seats/${enc(agentSeatId)}/rotate-token`, {
      method: "POST",
      token,
    }),
  streamUrl: (roomId: string) => `${API_URL}/rooms/${enc(roomId)}/stream`,
};

export type { Approval };
