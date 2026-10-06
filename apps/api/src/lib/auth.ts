import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { rooms, seats } from "../db/schema";
import { errors } from "./errors";
import type { Deps } from "./deps";
import { hashToken } from "./tokens";

export type Seat = typeof seats.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export interface Auth {
  seat: Seat;
  room: Room;
}

const BEARER = /^Bearer (own_[A-Za-z0-9_-]{20,})$/;

export function isRoomGone(room: Room): boolean {
  return room.status === "deleted" || room.expiresAt.getTime() <= Date.now();
}

/**
 * Resolve the human seat from the Bearer token. The room comes from the seat.
 * `:id` in the URL is only checked against it, never trusted.
 */
export function requireOwner(d: Deps, opts: { roomParam?: boolean } = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const m = BEARER.exec(req.header("authorization") ?? "");
      if (!m) throw errors.unauthorized();
      const [row] = await d.db
        .select({ seat: seats, room: rooms })
        .from(seats)
        .innerJoin(rooms, eq(rooms.id, seats.roomId))
        .where(eq(seats.tokenHash, hashToken(m[1]!)))
        .limit(1);
      if (!row || row.seat.kind !== "human") throw errors.unauthorized();
      if (opts.roomParam && req.params.id !== row.room.id) throw errors.unauthorized();
      if (isRoomGone(row.room)) throw errors.gone();
      await d.db.update(seats).set({ lastSeenAt: new Date() }).where(eq(seats.id, row.seat.id));
      res.locals.auth = { seat: row.seat, room: row.room } satisfies Auth;
      next();
    } catch (e) {
      next(e);
    }
  };
}

export const getAuth = (res: Response): Auth => res.locals.auth as Auth;

const AGENT_TOKEN = /^agt_[A-Za-z0-9_-]{20,}$/;

/**
 * Resolve the agent seat for /mcp. The token comes from the path or from
 * `Authorization: Bearer agt_...`. If both are sent and differ, it is a 401.
 * A readonly room still authenticates (reads work, posts fail with ROOM_READONLY);
 * a deleted or expired room does not.
 */
export function requireAgent(d: Deps) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pathToken = req.params.agent_token;
      const header = /^Bearer (.+)$/.exec(req.header("authorization") ?? "")?.[1];
      if (pathToken && header && pathToken !== header) throw errors.unauthorized();
      const token = pathToken ?? header;
      if (!token || !AGENT_TOKEN.test(token)) throw errors.unauthorized();
      const [row] = await d.db
        .select({ seat: seats, room: rooms })
        .from(seats)
        .innerJoin(rooms, eq(rooms.id, seats.roomId))
        .where(eq(seats.tokenHash, hashToken(token)))
        .limit(1);
      if (!row || row.seat.kind !== "agent" || isRoomGone(row.room)) throw errors.unauthorized();
      res.locals.auth = { seat: row.seat, room: row.room } satisfies Auth;
      next();
    } catch (e) {
      next(e);
    }
  };
}
