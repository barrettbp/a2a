# Not Fixed Bugs

Everything known and not fixed yet, plus every edge case and what its status is. Fix all of it in one pass when the project is done (after Phase 5). Update this file whenever something new is found or something gets fixed. When an item is fixed, move it to the "Fixed" section at the bottom with the commit.

Severity: **M** medium, **L** low, **I** info or decision needed.

## A. Security and abuse (from the Phase 2 review, not fixed)

| ID | Sev | What | Where | Suggested fix |
| --- | --- | --- | --- | --- |
| A1 | L | No rate limit on `wait_for_messages`, `read_messages`, `join_room`, `check_approval`. `touch()` writes to the DB on every tool call. A token holder can flood the 10-connection pool. | `services/agent.ts`, `mcp/server.ts` | Generic per-seat limiter in the tool wrapper. Throttle `touch` (write at most every 10 s). |
| A2 | L | No limit on failed auth (unknown token lookups cost a DB query each). | `lib/auth.ts` | Per-IP limiter on 401s. |
| A3 | L | SSE has no cap on streams per seat, and `res.write` ignores backpressure (a stalled client buffers events in memory). | `routes/index.ts` stream handler | Cap about 5 streams per seat. Drop a client when `res.write` stays false. |
| A4 | M | Names are not reserved. An agent can name itself `Snapwork`, `YOU`, `ALL`, `System` or copy a human's name. The "left the room" system message is built from the agent's free-text name and shows as `SYSTEM`, so it can spoof server text. A homoglyph name bypasses the " (2)" collision check. An agent can rename itself on every `join_room`. | `services/agent.ts` (`joinRoom`, `leaveRoom`, `agentView`) | Reserved-name list plus other participants' names. Compare after NFKC and lowercase. Wrap `from.name` and `to` with `wrapUntrusted`, or send ids plus roles only. Build system messages from structured `meta`, not free text. Post a system message on rename. |
| A5 | L | `"` and backticks are still allowed in names. The connect prompt interpolates `roomName`, `ownerName`, `otherName`, `agentName` as plain text (one line now, but not quoted). | `packages/shared/src/templates.ts` | JSON-quote values in the template, or reject `"` and backtick in names. |
| A6 | L | `request_approval` and `report_done` do not run the pause check and do not evaluate the pause rule after posting. Only `post_message` does. | `services/agent.ts` | Gate on `c.paused`, or run the same window check. Document if kept. |
| A7 | L | Every message goes to both agents. An agent also sees the other owner's `approval_request` and `approval_decision`. The rules block does not tell agents to match `meta.approval_id` against their own approval. | `packages/shared/src/templates.ts` (`rulesBlock`) | Add a rule: act only on a decision whose `approval_id` you created. |
| A8 | L | `claimInvite` posts a "joined" system message even when the room is `readonly`. | `services/rooms.ts` | Skip the message when `c.status === "readonly"`. |
| A9 | I | In a `readonly` room a human cannot decline a pending approval (`ROOM_READONLY`). | `services/approvals.ts` | Decide: allow decisions in readonly rooms, or document. |
| A10 | I | `trust proxy` is `1`. It is only right with exactly one proxy hop (Railway). Extra hops (Cloudflare) make `req.ip` wrong and the IP limits useless. | `app.ts` | Make it an env setting. Check the real hop count at deploy. |
| A11 | L | Agent tokens sit in the URL path. Railway's edge may log the path. Accepted trade-off in §10, listed so it is not forgotten. | `routes/mcp.ts` | Prefer the header form for clients that support it. Say so in the README. |
| A12 | I | `pnpm audit` is not in CI. There is no CI at all yet. §10 asks for it. | repo root | Add a GitHub Action (typecheck, test, audit). |

## B. Behaviour that differs from PROJECT.md or is a judgement call

| ID | What | Decision needed |
| --- | --- | --- |
| B1 | §6 says reject with 401 when the room is "not active". §11 says a `readonly` room still allows reads. I followed §11: `readonly` authenticates, deleted or expired gives 401. | Confirm. |
| B2 | `wait_for_messages` does not return the agent's own messages. It moves the cursor past them. `read_messages` returns everything. §6 does not say either way. | Confirm. |
| B3 | Greeting messages count as agent messages in the pause window. Two greetings plus four posts pause the room. | Confirm or exclude greetings. |
| B4 | `leave_room` sets `last_seen_at` to `null`, so the web cannot show "last seen". The "left" message is posted once (based on the seat's last-seen before the call). | Maybe keep a separate `offline` flag. Needs a schema change, so ask first. |
| B5 | Claiming an invite posts "{name} joined the room." for the human. §8 lists the string but not when it is used. | Confirm. |
| B6 | `join_room` posts no system message for agents (only the greeting). | Confirm. |
| B7 | I added the `roomFull` system message (en and vi) and the `INTERNAL` error code. Neither is in §8 or §6. | Confirm the Vietnamese text. |
| B8 | Approval decision message body is English text (`Approved: ...`), not localised. | Confirm. |
| B9 | `request_approval` and `report_done` are rate limited like §9 (5/min and 20/min). `leave_room` has my own limit of 3/min. | Confirm. |
| B10 | SSE needs a Bearer header, so the browser `EventSource` cannot be used. | Done in Phase 3: `apps/web/src/sse.ts` uses `fetch` with a stream reader and its own frame parser. Checked once against the real API in a scratch test (live, 401 gives fatal). |

## C. Not verified yet

| ID | What | How to close it |
| --- | --- | --- |
| C1 | Never run against a real Supabase Postgres. Migration and tests ran on PGlite only. `db:migrate` and `db:seed` are untested on a real database. | Run both against a Supabase project (pooler URL). |
| C2 | One POST to `/mcp` returned 400 at the start of a real Claude Code session. The rest returned 200 and the scenario worked. Cause not found (logs do not hold bodies). | Reproduce with a header dump in a scratch run. Suspect an unsupported `MCP-Protocol-Version` or a probe request. |
| C3 | MCP Inspector was not used. Only the SDK client and one `claude -p` session were tested. | Run Inspector once. |
| C4 | Claude Desktop and ChatGPT custom connectors were not tested. They may expect OAuth discovery (`/.well-known/...`) and get a JSON 404 from us. | Test both in Phase 5. If they need OAuth, this changes the design. Raise early. |
| C5 | Only one scenario was run with a real agent (one approval round trip). Agent-to-agent chat with two real agents was not run. | Phase 5 two-machine test. |
| C6 | `Dockerfile`, `railway.json` and `netlify.toml` were never built or deployed. | Deploy once in Phase 5. |
| C7 | Dev environment ran Node 22. The Dockerfile uses Node 20. pnpm ignored the esbuild build scripts (it worked anyway). | Run the tests on Node 20 in CI. |
| C8 | Expiry job: `deleteExpiredRooms` is tested, the hourly timer is not. | Test with fake timers. |
| C9 | SSE: replay past 500 messages (paging), the 20 s heartbeat, and many parallel streams are not tested. | Add tests. |
| C10 | Rate limiter memory: the map grows by key until the sweep runs (every 1000 calls). No hard cap. | Add a max size. |
| C11 | Rate limits live in process memory. A restart resets them. The SSE bus and waiters only work with one API process. | Fine for MVP. Needs LISTEN/NOTIFY and a shared store before running two instances. |
| C12 | Polling: `wait_for_messages` polls the DB every 1 s as a safety net, one query per second per waiting agent. | Fine at this scale. |
| C13 | A superseded wait can lag up to 1 s if the old call is in the middle of a query. | Accept. |
| C14 | The seed script prints tokens to the console (dev only). | Do not run it in production. |

## D. Edge cases from PROJECT.md section 11

| Edge case | Status |
| --- | --- |
| Agent joins before the second human claims | Handled and tested. Participants show `claimed: false` and `name: null`. The UI label "Waiting for invite" is Phase 3. |
| Agent restarts and joins again, no second greeting | Handled and tested. |
| Agent stops looping, UI shows "last seen 3 min ago" | Server stores `last_seen_at`. UI is Phase 3. |
| Creator opens own invite link in another browser | Allowed. Not tested. |
| Invite opened after the room expired or was deleted | Handled and tested (`410`, "This room is gone."). |
| Agent name collision, " (2)" appended | Handled and tested. Weak against homoglyphs (A4). |
| Body over 4000 characters | Handled and tested (`BODY_TOO_LONG`). |
| Two `request_approval` calls in a row | Handled and tested (`APPROVAL_PENDING`). |
| Owner offline while an approval is pending | By design no timeout. Not tested. |
| Decision arrives during an open long-poll | Handled and tested, returns at once. |
| `report_done` on a declined or done approval | Handled and tested (`NOT_APPROVED`). |
| SSE drops, client reconnects with `Last-Event-ID` | Server replay handled and tested. The client side is Phase 3. |
| Token in path and header differ | Handled and tested (`401`). |
| Room `readonly`: posts fail, reads and SSE work | Handled and tested for REST and MCP. SSE in readonly not tested. |
| `lang` other than `en` or `vi` | Handled and tested (`VALIDATION`). |

## E. Process

| ID | What |
| --- | --- |
| E1 | `.claude/agents/` does not exist (`coder`, `debugger`, `designer`, `security-reviewer`). The Phase 2 review used a general-purpose subagent with a written brief. |
| E2 | `README.md` is only the title. The Definition of Done needs the how-to for Claude Code, Claude Desktop and ChatGPT. |
| E3 | Sentry DSN (optional, Phase 5) not started. |

## F. Web (Phase 3)

| ID | Sev | What | Suggested fix |
| --- | --- | --- | --- |
| F1 | M | Nothing was run in a real browser or on a phone (no browser in the build sandbox). Layout at 390 px, the native `<dialog>` sheet and confirm dialog, focus order, scroll pinning, the IME guard in a real Vietnamese keyboard, and clipboard behaviour are only covered by jsdom unit tests and a build. | Run the phone and laptop acceptance test. Fix what shows up. |
| F2 | L | Exit animations are missing for the bottom sheet, tablet panel, scrim and confirm dialog (native `<dialog>` closes instantly). Enter animations exist. | Animate with a `closing` class before calling `close()`. |
| F3 | L | The copy button does not lock its width, so "Copy" to "Copied" can shift a few pixels. | Render both labels in a grid and hide one. |
| F4 | I | The connect prompt (it contains the agent token) is kept in `sessionStorage` for the tab, as the task asked. Design 5.2 said React state only. It is never in `localStorage` and never logged. Any script running in the page could read it, and the page loads no third-party script (only the Google Fonts stylesheet). | Confirm, or drop the reload convenience. |
| F5 | L | The SSE stream has no `room` event, so `paused` and `status` only refresh when the web refetches `GET /rooms/:id`. The web does that after every system message, after a `seat` event, while paused, and on every (re)connect. A short delay (about 0.4 s) is possible. | API: emit a `room` event `{paused, status}`. |
| F6 | L | Only the latest 50 messages load. There is no "load older" control. `pending_approvals` only lists pending ones, so an approval's final state is derived from the structured `approval_decision` and `result` messages that are in the loaded page. A decision always sits after its request, so both load together unless the page cut falls between them (then the card shows Pending). | Add paging with `before_id` (API change) and a "Load earlier" button. |
| F7 | L | Replay after a reconnect is told apart from live messages by a time window (1.5 s after the stream opens). A real new message inside that window loses its entrance animation and its screen reader announcement. | API could mark replayed frames, or the client could compare ids against the id at disconnect. |
| F8 | I | Reconnect backoff is 1, 2, 4, 8, 10 s (the task said max 10 s, the design hint said 8 s). The client also retries on `online` and when the tab becomes visible again, and treats 45 s without bytes as a dead stream. | Confirm. |
| F9 | I | Bookmark banner: the key `snapwork:banner-dismissed:{room}` holds `no` (show) or `yes` (dismissed), so the banner survives a reload until dismissed. | Fine, or split into two keys. |
| F10 | L | If `localStorage` is blocked, the owner token stays in the URL fragment (it is not stripped) so a reload still works, the bookmark banner does not show, and the invite link is lost after the first load. | None needed. Documented. |
| F11 | L | The "To" picker lists the other agent only when it has a name (claimed). Agent names that the agent changed with `join_room` update only after the next snapshot refresh (seat events). | Fine. |
| F12 | I | Approve and Decline on the card send no note (design 4.2). A note needs `/decline note` typed in the composer. | Confirm. |
| F13 | L | A message that fails with a network error but reached the server is shown as "Not sent". If the user retries, it is posted twice. The echo from SSE does not merge into a failed item. | Add a client id to `POST /rooms/:id/messages` and dedupe on the server. |
| F14 | I | `docs/design-review.html` was skimmed, not compared pixel by pixel. | Review in a browser. |

## Fixed (kept for the record)

| What | Commit |
| --- | --- |
| Error handler logged `err.message`, which holds SQL and bound params (message bodies, token hashes). Now logs error class and Postgres code only. Test added. | Phase 2 security review fixes |
| Rate limiter sweep erased hourly limits. Each key now keeps its own window. | same |
| `leave_room` unlimited and spammy. Limited to 3/min, posts once. | same |
| Names could carry newlines, control and zero-width characters into connect prompts. Now one clean line. | same |
| Untrusted wrapper only escaped the plain closing tag. Now neutralises any opener or closer, with attributes, spacing, fullwidth and zero-width tricks. | same |
| SSE cleanup used `req` close and could leak a timer. Now `res` close plus a destroyed check. | same |
| Rotating a token left an open long-poll running. Now ends it. | same |
| Bad uuid, huge cursor or NUL character caused a 500. Now `VALIDATION`. | same |
| JSON-RPC batches on `/mcp` bypassed per-call limits. Now rejected. | same |
| `WEB_ORIGIN` trailing slash, `X-Powered-By` header. | same |
| `requireOwner` compared `:id` to the room id on `/approvals/:id` (401 for the real owner). | Phase 1 |
