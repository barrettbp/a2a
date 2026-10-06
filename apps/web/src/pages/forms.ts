import { ApiError } from "../api";

/** Message for the form-level error box. */
export function formErrorText(e: unknown, rateLimited: string): string {
  if (e instanceof ApiError) {
    if (e.status === 429 || e.code === "RATE_LIMITED") return rateLimited;
    if (e.code === "VALIDATION") return e.message;
  }
  return "Couldn't reach Snapwork. Check your connection and try again.";
}
