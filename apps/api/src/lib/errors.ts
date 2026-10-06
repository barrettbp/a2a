import type { ErrorCode } from "@snapwork/shared";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const errors = {
  unauthorized: (m = "Missing or invalid token.") => new AppError("UNAUTHORIZED", m, 401),
  forbidden: (m = "You are not allowed to do that.") => new AppError("UNAUTHORIZED", m, 403),
  notFound: (m = "Not found.") => new AppError("NOT_FOUND", m, 404),
  gone: (m = "This room is gone.") => new AppError("GONE", m, 410),
  validation: (m: string, status = 400) => new AppError("VALIDATION", m, status),
  rateLimited: () => new AppError("RATE_LIMITED", "Too many requests. Try again later.", 429),
  readonly: () => new AppError("ROOM_READONLY", "This room is read-only.", 403),
  paused: () =>
    new AppError("PAUSED_WAITING_FOR_HUMAN", "Paused: waiting for a human to reply.", 409),
  bodyTooLong: (max: number) => new AppError("BODY_TOO_LONG", `Message is over ${max} characters.`, 400),
};
