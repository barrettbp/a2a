import { and, eq } from "drizzle-orm";
import type { Seat } from "../lib/auth";
import type { Deps } from "../lib/deps";
import { errors } from "../lib/errors";
import { approvals } from "../db/schema";
import { applyDecision, withRoomLock } from "./messages";

export async function decideApproval(
  d: Deps,
  seat: Seat,
  approvalId: string,
  status: "approved" | "declined",
  note?: string,
): Promise<{ message_id: number }> {
  return withRoomLock(d, seat.roomId, async (c) => {
    if (c.status === "readonly") throw errors.readonly();
    // Scoped to the caller's room: an id from another room is simply not found.
    const [ap] = await c.tx
      .select()
      .from(approvals)
      .where(and(eq(approvals.id, approvalId), eq(approvals.roomId, c.room.id)))
      .for("update");
    if (!ap) throw errors.notFound("Approval not found.");
    if (ap.ownerSeatId !== seat.id) throw errors.forbidden("Only the agent's owner can decide this.");
    if (ap.status !== "pending") throw errors.validation("This approval was already decided.", 409);
    return { message_id: await applyDecision(c, ap, status, note) };
  });
}
