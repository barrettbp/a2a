import cors from "cors";
import express from "express";

export function createApp(opts: { webOrigin: string }) {
  const app = express();
  app.use(cors({ origin: opts.webOrigin }));
  app.use(express.json({ limit: "64kb" }));
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}
