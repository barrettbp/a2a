import {
  claimInviteSchema,
  createRoomSchema,
  decideApprovalSchema,
  postMessageSchema,
} from "@snapwork/shared";
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import { getAuth, requireOwner } from "../lib/auth";
import type { Deps } from "../lib/deps";
import { errors } from "../lib/errors";
import { decideApproval } from "../services/approvals";
import { messageWire, postMessage, readMessages } from "../services/messages";
import {
  claimInvite,
  createRoom,
  getRoomView,
  previewInvite,
  rotateAgentToken,
} from "../services/rooms";
import { messages } from "../db/schema";
import { and, asc, eq, gt } from "drizzle-orm";

const ah =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => {
    fn(req, res).catch(next);
  };

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw errors.validation(r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  }
  return r.data;
}

const ip = (req: Request) => req.ip ?? "unknown";

const querySchema = z.object({
  after_id: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});

export function buildRouter(d: Deps): Router {
  const r = Router();
  const auth = requireOwner(d);
  const roomAuth = requireOwner(d, { roomParam: true });

  r.post(
    "/rooms",
    ah(async (req, res) => {
      if (!d.limiter.allow(`create:${ip(req)}`, d.limits.createPerHour, 3600_000)) throw errors.rateLimited();
      res.status(201).json(await createRoom(d, parse(createRoomSchema, req.body)));
    }),
  );

  r.get(
    "/rooms/:id",
    roomAuth,
    ah(async (_req, res) => {
      const { room, seat } = getAuth(res);
      res.json(await getRoomView(d.db, room, seat));
    }),
  );

  r.get(
    "/rooms/:id/messages",
    roomAuth,
    ah(async (req, res) => {
      const q = parse(querySchema, req.query);
      res.json(await readMessages(d.db, getAuth(res).room.id, { afterId: q.after_id, limit: q.limit }));
    }),
  );

  r.post(
    "/rooms/:id/messages",
    roomAuth,
    ah(async (req, res) => {
      const raw = req.body as { body?: unknown } | undefined;
      if (typeof raw?.body === "string" && raw.body.length > d.limits.bodyMax) throw errors.bodyTooLong(d.limits.bodyMax);
      const input = parse(postMessageSchema, req.body);
      const out = await postMessage(d, getAuth(res).seat, { body: input.body, toSeatId: input.to_seat_id });
      res.status(201).json(out);
    }),
  );

  r.get(
    "/rooms/:id/stream",
    roomAuth,
    ah(async (req, res) => {
      const { room } = getAuth(res);
      const header = Number(req.header("last-event-id"));
      const after = Number.isFinite(header) && header >= 0 && req.header("last-event-id") ? header : undefined;

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.write("retry: 3000\n\n");

      // Subscribe first and buffer, so nothing is lost between replay and live.
      let sentId = after ?? 0;
      let replaying = after !== undefined;
      const buffer: Parameters<Parameters<typeof d.bus.subscribe>[1]>[0][] = [];
      const send = (e: (typeof buffer)[number]) => {
        if (e.type === "message") {
          if (e.id <= sentId) return;
          sentId = e.id;
          res.write(`id: ${e.id}\nevent: message\ndata: ${JSON.stringify(e.data)}\n\n`);
        } else {
          res.write(`event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`);
        }
      };
      const unsubscribe = d.bus.subscribe(room.id, (e) => (replaying ? buffer.push(e) : send(e)));
      const heartbeat = setInterval(() => res.write(": hb\n\n"), 20_000);
      req.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
      });

      if (after !== undefined) {
        let cursor = after;
        for (;;) {
          const rows = await d.db
            .select()
            .from(messages)
            .where(and(eq(messages.roomId, room.id), gt(messages.id, cursor)))
            .orderBy(asc(messages.id))
            .limit(500);
          for (const m of rows) send({ type: "message", id: m.id, data: messageWire(m) });
          if (rows.length < 500) break;
          cursor = rows.at(-1)!.id;
        }
        replaying = false;
        for (const e of buffer.splice(0)) send(e);
      }
    }),
  );

  r.post(
    "/approvals/:id/decide",
    auth,
    ah(async (req, res) => {
      const input = parse(decideApprovalSchema, req.body);
      res.json(await decideApproval(d, getAuth(res).seat, req.params.id!, input.status, input.note));
    }),
  );

  r.post(
    "/seats/:agent_seat_id/rotate-token",
    auth,
    ah(async (req, res) => {
      res.json(await rotateAgentToken(d, getAuth(res).seat, req.params.agent_seat_id!));
    }),
  );

  r.get(
    "/invites/:token",
    ah(async (req, res) => {
      res.json(await previewInvite(d.db, req.params.token!));
    }),
  );

  r.post(
    "/invites/:token/claim",
    ah(async (req, res) => {
      if (!d.limiter.allow(`claim:${ip(req)}`, d.limits.claimPerHour, 3600_000)) throw errors.rateLimited();
      res.status(201).json(await claimInvite(d, req.params.token!, parse(claimInviteSchema, req.body)));
    }),
  );

  return r;
}
