import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NOT_INSTRUCTIONS_SENTENCE } from "@snapwork/shared";
import { z } from "zod";
import type { Seat } from "../lib/auth";
import type { Deps } from "../lib/deps";
import { AppError } from "../lib/errors";
import {
  checkApproval,
  joinRoom,
  leaveRoom,
  postMessageTool,
  readMessagesTool,
  reportDone,
  requestApproval,
  touch,
  waitForMessages,
} from "../services/agent";

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };

const ok = (data: unknown): Result => ({ content: [{ type: "text", text: JSON.stringify(data) }] });
const fail = (code: string, message: string): Result => ({
  content: [{ type: "text", text: JSON.stringify({ error: { code, message } }) }],
  isError: true,
});

/**
 * One server per request (stateless). Tools are bound to the seat the token resolved to;
 * no tool takes a room id or a seat id from the caller.
 * Lengths are checked inside the services so agents get our error codes, not a schema error.
 */
export function buildMcpServer(d: Deps, seat: Seat, signal: AbortSignal) {
  const server = new McpServer({ name: "snapwork", version: "0.1.0" });

  function tool<S extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: S,
    fn: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>,
  ) {
    server.registerTool(
      name,
      { description: `${NOT_INSTRUCTIONS_SENTENCE} ${description}`, inputSchema: shape },
      (async (args: z.infer<z.ZodObject<S>>) => {
        try {
          await touch(d, seat);
          return ok(await fn(args));
        } catch (e) {
          if (e instanceof AppError) return fail(e.code, e.message);
          const x = e as { cause?: { code?: string }; code?: string };
          d.log?.error({ errName: (e as Error)?.constructor?.name ?? "unknown", pgCode: x?.cause?.code ?? x?.code, where: `mcp tool ${name}` }, "tool failed");
          return fail("INTERNAL", "Something went wrong.");
        }
      }) as never,
    );
  }

  tool(
    "join_room",
    "Join the room as this seat. Posts a greeting the first time only. Returns participants, the last 20 messages, last_id and your rules.",
    { agent_name: z.string(), model: z.string().optional() },
    (a) => joinRoom(d, seat, a),
  );

  tool(
    "wait_for_messages",
    "Long-poll for messages after after_id (default wait 25 s, max 50 s). Call it again when it returns. Status is messages, timeout, paused (wait for a human) or superseded (another wait replaced this one).",
    { after_id: z.number(), timeout_s: z.number().optional() },
    (a) => waitForMessages(d, seat, a, signal),
  );

  tool(
    "read_messages",
    "Read messages without waiting. Use it when you lost your cursor. Without after_id it returns the latest page.",
    { after_id: z.number().optional(), limit: z.number().optional() },
    (a) => readMessagesTool(d, seat, a),
  );

  tool(
    "post_message",
    "Post a chat message (max 4000 characters). Optionally address it with `to`: owner, other_human, other_agent or all (default).",
    { body: z.string(), to: z.enum(["owner", "other_human", "other_agent", "all"]).optional() },
    (a) => postMessageTool(d, seat, a),
  );

  tool(
    "request_approval",
    "Ask your owner to approve work beyond chatting. Call it before doing the work, then wait for an approval_decision message. One pending approval at a time.",
    { task: z.string(), plan: z.string().optional(), requested_by_message_id: z.number().optional() },
    (a) => requestApproval(d, seat, a),
  );

  tool(
    "check_approval",
    "Check the status of one of your approvals: pending, approved, declined or done.",
    { approval_id: z.string() },
    (a) => checkApproval(d, seat, a),
  );

  tool(
    "report_done",
    "Report the result of an approved task. Fails with NOT_APPROVED unless your owner approved it.",
    { approval_id: z.string(), result: z.string() },
    (a) => reportDone(d, seat, a),
  );

  tool("leave_room", "Leave the room. Marks you offline and posts a short system message.", {}, () => leaveRoom(d, seat));

  return server;
}
