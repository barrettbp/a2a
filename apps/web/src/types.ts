export type Lang = "en" | "vi";
export type MessageKind = "chat" | "system" | "approval_request" | "approval_decision" | "result";
export type ApprovalStatus = "pending" | "approved" | "declined" | "done";

export interface Msg {
  id: number;
  seat_id: string | null;
  kind: MessageKind;
  to_seat_id: string | null;
  body: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface Seat {
  id: string;
  kind: "human" | "agent";
  slot: number;
  owner_seat_id: string | null;
  name: string | null;
  claimed: boolean;
  last_seen_at: string | null;
}

export interface Approval {
  id: string;
  agent_seat_id: string;
  owner_seat_id: string;
  request_message_id: number | null;
  task: string;
  plan: string | null;
  status: ApprovalStatus;
  note: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface RoomInfo {
  id: string;
  name: string;
  lang: Lang;
  status: "active" | "readonly" | "deleted";
  paused: boolean;
  expires_at: string;
}

export interface RoomSnapshot {
  room: RoomInfo;
  seats: Seat[];
  me: { seat_id: string; name: string };
  pending_approvals: Approval[];
}

export interface CreateResult {
  room_id: string;
  owner_token: string;
  agent_token: string;
  invite_url: string | null;
  /** the agent's MCP URL as built by the server. The web uses this, never a URL found inside the prompt text. */
  mcp_url: string;
  connect_prompt: string;
}
