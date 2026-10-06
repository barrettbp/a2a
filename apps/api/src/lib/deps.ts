import type { Db } from "../db/client";
import type { RoomBus } from "./bus";
import type { WaiterRegistry } from "../services/agent";
import type { Limits } from "./limits";
import type { RateLimiter } from "./rateLimit";

export interface Deps {
  db: Db;
  bus: RoomBus;
  limiter: RateLimiter;
  waiters: WaiterRegistry;
  limits: Limits;
  apiPublicUrl: string;
  webOrigin: string;
}
