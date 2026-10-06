import type { Db } from "../db/client";
import type { RoomBus } from "./bus";
import type { Limits } from "./limits";
import type { RateLimiter } from "./rateLimit";

export interface Deps {
  db: Db;
  bus: RoomBus;
  limiter: RateLimiter;
  limits: Limits;
  apiPublicUrl: string;
  webOrigin: string;
}
