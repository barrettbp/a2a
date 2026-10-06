import { z } from "zod";

export const langSchema = z.enum(["en", "vi"]);
export type Lang = z.infer<typeof langSchema>;

export const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(80),
  owner_name: z.string().trim().min(1).max(60),
  agent_name: z.string().trim().min(1).max(60).optional(),
  lang: langSchema,
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const claimInviteSchema = z.object({
  name: z.string().trim().min(1).max(60),
  agent_name: z.string().trim().min(1).max(60).optional(),
});
export type ClaimInviteInput = z.infer<typeof claimInviteSchema>;

export const postMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  to_seat_id: z.string().uuid().optional(),
});
export type PostMessageInput = z.infer<typeof postMessageSchema>;

export const decideApprovalSchema = z.object({
  status: z.enum(["approved", "declined"]),
  note: z.string().max(500).optional(),
});
export type DecideApprovalInput = z.infer<typeof decideApprovalSchema>;

export const MESSAGE_KINDS = ["chat", "system", "approval_request", "approval_decision", "result"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "declined", "done"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const ERROR_CODES = [
  "UNAUTHORIZED",
  "NOT_FOUND",
  "GONE",
  "VALIDATION",
  "PAUSED_WAITING_FOR_HUMAN",
  "RATE_LIMITED",
  "ROOM_READONLY",
  "BODY_TOO_LONG",
  "APPROVAL_PENDING",
  "NOT_APPROVED",
  "INTERNAL",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
