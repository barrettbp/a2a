import pino from "pino";
import { createApp } from "./app";
import { createDb } from "./db/client";
import { loadEnv } from "./env";
import { startExpiryJob } from "./services/rooms";

const env = loadEnv();
const log = pino();
const { db } = createDb(env.DATABASE_URL);
const { app } = createApp({
  db,
  webOrigin: env.WEB_ORIGIN,
  apiPublicUrl: env.API_PUBLIC_URL,
  log,
});

startExpiryJob(db, (e) => log.error({ errName: (e as Error)?.constructor?.name }, "expiry job failed"));

app.listen(env.PORT, () => {
  log.info({ port: env.PORT }, "api listening");
});
