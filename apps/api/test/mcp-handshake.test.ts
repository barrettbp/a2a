import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";
import { makeApp, roomWithBoth } from "./helpers";

/**
 * Bug C2. Claude Code 2.1.292 opens with a `server/discover` probe carrying
 * `MCP-Protocol-Version: 2026-07-28`, newer than SDK 1.32.1 knows. The SDK answers 400
 * (spec: unsupported version on a non-initialize request), the client falls back to
 * `initialize`, and the session works. This replays the recorded sequence so a change in
 * the route or an SDK upgrade cannot silently break that fallback.
 */
let server: Server | undefined;
afterEach(() => {
  server?.closeAllConnections();
  server?.close();
});

const ACCEPT = "application/json, text/event-stream";

async function setup() {
  const made = await makeApp();
  server = createServer(made.app).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const r = await roomWithBoth(made.api);
  const url = `${base}/mcp/${r.a.agent}`;
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: ACCEPT, ...headers },
      body: JSON.stringify(body),
    });
  return { url, post };
}

const initialize = (protocolVersion: string) => ({
  jsonrpc: "2.0",
  id: 0,
  method: "initialize",
  params: { protocolVersion, capabilities: {}, clientInfo: { name: "claude-code", version: "2.1.292" } },
});

describe("MCP handshake (bug C2)", () => {
  it("replays the Claude Code startup: discover probe 400, then initialize, notify, GET 405, tools/list", async () => {
    const { url, post } = await setup();

    const discover = await post(
      { jsonrpc: "2.0", id: 0, method: "server/discover", params: {} },
      { "MCP-Protocol-Version": "2026-07-28" },
    );
    expect(discover.status).toBe(400);
    const dj = (await discover.json()) as { error: { code: number; message: string } };
    expect(dj.error.code).toBe(-32000);
    expect(dj.error.message).toMatch(/Unsupported protocol version: 2026-07-28/);

    const init = await post(initialize("2025-11-25"));
    expect(init.status).toBe(200);
    expect(init.headers.get("mcp-session-id")).toBeNull(); // stateless
    const ij = (await init.json()) as { result: { protocolVersion: string; serverInfo: { name: string } } };
    expect(ij.result.protocolVersion).toBe("2025-11-25");
    expect(ij.result.serverInfo.name).toBe("snapwork");

    const v = { "MCP-Protocol-Version": "2025-11-25" };
    expect((await post({ jsonrpc: "2.0", method: "notifications/initialized" }, v)).status).toBe(202);
    expect((await fetch(url, { headers: { Accept: "text/event-stream", ...v } })).status).toBe(405);

    const list = await post({ jsonrpc: "2.0", id: 1, method: "tools/list" }, v);
    expect(list.status).toBe(200);
    expect(((await list.json()) as { result: { tools: unknown[] } }).result.tools).toHaveLength(8);
  });

  it("negotiates an unknown newer protocolVersion in initialize down to one it supports", async () => {
    const { post } = await setup();
    const res = await post(initialize("2026-07-28"), { "MCP-Protocol-Version": "2026-07-28" });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { result: { protocolVersion: string } };
    expect(j.result.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
  });

  it("ignores a stray Mcp-Session-Id header (stateless)", async () => {
    const { post } = await setup();
    const res = await post(
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { "MCP-Protocol-Version": "2025-11-25", "Mcp-Session-Id": "left-over-from-another-server" },
    );
    expect(res.status).toBe(200);
  });
});
