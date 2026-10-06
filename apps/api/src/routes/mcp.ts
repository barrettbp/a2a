import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Router } from "express";
import { getAuth, requireAgent } from "../lib/auth";
import type { Deps } from "../lib/deps";
import { buildMcpServer } from "../mcp/server";

/**
 * Streamable HTTP, stateless: a new server and transport for every request.
 * JSON responses (no SSE) so a 50 s long-poll is one plain request that proxies leave alone.
 * The route pattern is what gets logged, never the URL: the token is in the path.
 */
export function mcpRouter(d: Deps): Router {
  const r = Router();

  r.all(["/mcp/:agent_token", "/mcp"], requireAgent(d), async (req, res, next) => {
    try {
      if (req.method !== "POST") {
        // Stateless: there is no session to stream to or to close.
        res.status(405).set("Allow", "POST").json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method not allowed. Use POST." },
          id: null,
        });
        return;
      }
      const { seat } = getAuth(res);
      const abort = new AbortController();
      const server = buildMcpServer(d, seat, abort.signal);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on("close", () => {
        abort.abort();
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
