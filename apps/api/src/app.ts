import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import type { Db } from "./db/client";
import { RoomBus } from "./lib/bus";
import type { Deps } from "./lib/deps";
import { AppError } from "./lib/errors";
import { DEFAULT_LIMITS, type Limits } from "./lib/limits";
import { RateLimiter } from "./lib/rateLimit";
import { buildRouter } from "./routes";
import { mcpRouter } from "./routes/mcp";
import { WaiterRegistry } from "./services/agent";

export interface AppOptions {
  db: Db;
  webOrigin: string;
  apiPublicUrl: string;
  limits?: Partial<Limits>;
  log?: Logger;
}

export function createApp(opts: AppOptions) {
  const deps: Deps = {
    db: opts.db,
    bus: new RoomBus(),
    limiter: new RateLimiter(),
    waiters: new WaiterRegistry(),
    limits: { ...DEFAULT_LIMITS, ...opts.limits },
    apiPublicUrl: opts.apiPublicUrl.replace(/\/$/, ""),
    webOrigin: opts.webOrigin,
  };

  const app = express();
  app.set("trust proxy", 1);
  app.use(cors({ origin: opts.webOrigin }));
  app.use(express.json({ limit: "64kb" }));

  // Log the route pattern, never the real URL (it can hold a token) and never a body.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      opts.log?.info(
        { method: req.method, route: req.route?.path ?? "unmatched", status: res.statusCode, ms: Date.now() - start },
        "request",
      );
    });
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use(buildRouter(deps));
  app.use(mcpRouter(deps));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found." } });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return res.end();
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    if (err instanceof ZodError || (err as { type?: string })?.type === "entity.parse.failed") {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid request body." } });
    }
    opts.log?.error({ err: err instanceof Error ? err.message : "unknown" }, "unhandled error");
    res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong." } });
  });

  return { app, deps };
}
