import pino from "pino";
import { createApp } from "./app";
import { loadEnv } from "./env";

const env = loadEnv();
const log = pino();
const app = createApp({ webOrigin: env.WEB_ORIGIN });

app.listen(env.PORT, () => {
  log.info({ port: env.PORT }, "api listening");
});
