import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { bearer, makeApp, roomWithBoth } from "./helpers";

let server: Server | undefined;
afterEach(() => {
  server?.closeAllConnections();
  server?.close();
});

/** Read SSE frames until `count` have arrived (heartbeat comments are skipped). */
async function readFrames(res: Response, count: number, abort: AbortController) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const frames: { id?: string; event?: string; data?: string }[] = [];
  while (frames.length < count) {
    const { value, done } = await reader.read();
    if (done) break;
    const text = dec.decode(value, { stream: true });
    buf += text;
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const raw = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (!raw.includes("event:")) continue;
      const f: Record<string, string> = {};
      for (const line of raw.split("\n")) {
        const k = line.indexOf(": ");
        if (k > 0) f[line.slice(0, k)] = line.slice(k + 2);
      }
      frames.push(f);
    }
  }
  abort.abort();
  return frames;
}

describe("SSE stream", () => {
  it("replays from Last-Event-ID, then sends live messages and approval events", async () => {
    const { app, api } = await makeApp();
    const r = await roomWithBoth(api);
    const post = (t: string, body: string) =>
      api.post(`/rooms/${r.roomId}/messages`).set(bearer(t)).send({ body });
    const m1 = await post(r.a.owner, "first");
    await post(r.b.owner, "second");

    server = createServer(app).listen(0);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const abort = new AbortController();
    const res = await fetch(`${base}/rooms/${r.roomId}/stream`, {
      signal: abort.signal,
      headers: { ...bearer(r.b.owner), "Last-Event-ID": String(m1.body.id) },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    // The live message is posted after the connection is open.
    // supertest requests are lazy: they only send once awaited or .then() is called.
    setTimeout(() => void post(r.a.owner, "third").then(), 200);
    const frames = await readFrames(res, 2, abort);
    const bodies = frames.map((f) => JSON.parse(f.data!).body);
    expect(bodies).toEqual(["second", "third"]);
    expect(frames.every((f) => f.event === "message" && f.id)).toBe(true);
    expect(Number(frames[0]!.id)).toBeGreaterThan(m1.body.id);
  });

  it("rejects a stream request with no token or another room's token", async () => {
    const { api } = await makeApp();
    const r1 = await roomWithBoth(api);
    const r2 = await roomWithBoth(api);
    expect((await api.get(`/rooms/${r1.roomId}/stream`)).status).toBe(401);
    expect((await api.get(`/rooms/${r1.roomId}/stream`).set(bearer(r2.a.owner))).status).toBe(401);
  });
});
