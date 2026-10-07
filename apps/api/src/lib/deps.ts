import type { Db } from "../db/client";
import type { RoomBus } from "./bus";
import type { WaiterRegistry } from "../services/agent";
import type { Limits } from "./limits";
import type { RateLimiter } from "./rateLimit";

/** Only the error class and the Postgres code are ever logged, never a message, query or parameter. */
export interface ErrorLog {
  error(fields: { errName: string; pgCode?: string; where: string }, msg: string): void;
}

export interface Deps {
  log?: ErrorLog;
  db: Db;
  bus: RoomBus;
  limiter: RateLimiter;
  waiters: WaiterRegistry;
  limits: Limits;
  apiPublicUrl: string;
  webOrigin: string;
}
