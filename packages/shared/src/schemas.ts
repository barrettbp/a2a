import { z } from "zod";

/**
 * Names end up inside prompts that other people paste into their agents, so keep them to one
 * plain line: no control, zero-width or bidi characters, whitespace collapsed.
 */
export function cleanLine(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const line = (max: number) => z.string().transform(cleanLine).pipe(z.string().min(1).max(max));

export const langSchema = z.enum(["en", "vi"]);
export type Lang = z.infer<typeof langSchema>;

export const createRoomSchema = z.object({
  name: line(80),
  owner_name: line(60),
  agent_name: line(60).optional(),
  lang: langSchema,
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const claimInviteSchema = z.object({
  name: line(60),
  agent_name: line(60).optional(),
});
export type ClaimInviteInput = z.infer<typeof claimInviteSchema>;

export const postMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  to_seat_id: z.string().uuid().optional(),
});
export type PostMessageInput = z.infer<typeof postMessageSchema>;

export const decideApprovalSchema = z.object({
  status: z.enum(["approved", "declined"]),
  note: z.string().max(500).refine((s) => !s.includes("\u0000"), "No NUL characters.").optional(),
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
