import { z } from "zod";

/**
 * Names end up inside prompts that other people paste into their agents, so keep them to one
 * plain line: no control, zero-width or bidi characters, whitespace collapsed.
 */
export function cleanLine(s: string): string {
  return s
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Characters that show nothing but can carry text or change how it reads: format characters (zero-width,
 * bidi, soft hyphen), private use, Unicode tag characters (hidden ASCII), variation selectors, and the
 * blank Hangul and Mongolian fillers.
 */
export const INVISIBLE =
  /[\p{Cf}\p{Co}\u034f\u115f\u1160\u3164\u180b-\u180f\u17b4\u17b5\u2800\ufffc\ufe00-\ufe0f\u{1d159}\u{e0000}-\u{e007f}\u{e0100}-\u{e01ef}]/gu;

/**
 * For message text. Removes what hides content from people or flips its direction (bidi overrides and isolates,
 * tag characters, soft hyphen, zero-width space, fillers) but keeps ZWJ, ZWNJ and VS16 so emoji and scripts that need them still work.
 */
export const HIDDEN_IN_TEXT = /[\u00ad\u200b\u2060-\u2064\ufeff\u202a-\u202e\u2066-\u2069\u115f\u1160\u3164\u180e\u{e0000}-\u{e007f}\u{e0100}-\u{e01ef}]/gu;
export const stripHidden = (s: string) => s.replace(HIDDEN_IN_TEXT, "");

/** Names go into install lines and prompts that people paste into a terminal or an agent. */
const UNSAFE_NAME = /[`$|;<>\\"]|:\/\//;
export const isSafeName = (s: string) => !UNSAFE_NAME.test(s);
export const UNSAFE_NAME_MESSAGE = 'Names can\'t contain ` $ | ; < > \\ " or a web address.';

const line = (max: number) =>
  z.string().transform(cleanLine).pipe(z.string().min(1).max(max).refine(isSafeName, UNSAFE_NAME_MESSAGE).refine((s) => /[\p{L}\p{N}]/u.test(s), "Names need at least one letter or number."));

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
