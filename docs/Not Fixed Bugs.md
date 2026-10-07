# Not Fixed Bugs

Everything known and not fixed yet, plus every edge case and what its status is. Fix all of it in one pass when the project is done (after Phase 5). Update this file whenever something new is found or something gets fixed. When an item is fixed, move it to the "Fixed" section at the bottom with the commit.

Severity: **M** medium, **L** low, **I** info or decision needed.

## A. Security and abuse (from the Phase 2 review, not fixed)

| ID | Sev | What | Where | Suggested fix |
| --- | --- | --- | --- | --- |
| A1 | L | No rate limit on `wait_for_messages`, `read_messages`, `join_room`, `check_approval`. `touch()` writes to the DB on every tool call. A token holder can flood the 10-connection pool. | `services/agent.ts`, `mcp/server.ts` | Generic per-seat limiter in the tool wrapper. Throttle `touch` (write at most every 10 s). |
| A2 | L | No limit on failed auth (unknown token lookups cost a DB query each). | `lib/auth.ts` | Per-IP limiter on 401s. |
| A3 | L | SSE has no cap on streams per seat, and `res.write` ignores backpressure (a stalled client buffers events in memory). | `routes/index.ts` stream handler | Cap about 5 streams per seat. Drop a client when `res.write` stays false. |
| A4 | M | Names are not reserved. An agent can name itself `Snapwork`, `YOU`, `ALL`, `System` or copy a human's name. The "left the room" system message is built from the agent's free-text name and shows as `SYSTEM`, so it can spoof server text. A homoglyph name bypasses the " (2)" collision check. An agent can rename itself on every `join_room`. | `services/agent.ts` (`joinRoom`, `leaveRoom`, `agentView`) | Reserved-name list plus other participants' names. Compare after NFKC and lowercase. Wrap `from.name` and `to` with `wrapUntrusted`, or send ids plus roles only. Build system messages from structured `meta`, not free text. Post a system message on rename. **Status after the Phase 5 review:** hidden characters (tag characters, fillers, zero-width, soft hyphen) are now stripped from names and message text, so invisible instructions are gone. Still open: reserved names, homoglyph names, and visible text in a name or `from.name` that sits outside the untrusted wrapper. |
| A5 | L | `"` and backticks are still allowed in names. The connect prompt interpolates `roomName`, `ownerName`, `otherName`, `agentName` as plain text (one line now, but not quoted). | `packages/shared/src/templates.ts` | JSON-quote values in the template, or reject `"` and backtick in names. **Status:** names are now rejected when they contain a backtick, `$`, `|`, `;`, `<`, `>`, a backslash, a double quote or `://`. The template still does not quote values; the web no longer reads the URL from the prompt text. |
| A6 | L | `request_approval` and `report_done` do not run the pause check and do not evaluate the pause rule after posting. Only `post_message` does. | `services/agent.ts` | Gate on `c.paused`, or run the same window check. Document if kept. |
| A7 | L | Every message goes to both agents. An agent also sees the other owner's `approval_request` and `approval_decision`. The rules block does not tell agents to match `meta.approval_id` against their own approval. | `packages/shared/src/templates.ts` (`rulesBlock`) | Add a rule: act only on a decision whose `approval_id` you created. |
| A8 | L | `claimInvite` posts a "joined" system message even when the room is `readonly`. | `services/rooms.ts` | Skip the message when `c.status === "readonly"`. |
| A9 | I | In a `readonly` room a human cannot decline a pending approval (`ROOM_READONLY`). | `services/approvals.ts` | Decide: allow decisions in readonly rooms, or document. |
| A10 | I | `trust proxy` is `1`. It is only right with exactly one proxy hop (Railway). Extra hops (Cloudflare) make `req.ip` wrong and the IP limits useless. | `app.ts` | Make it an env setting. Check the real hop count at deploy. Check on the first Railway deploy that different visitors get different `req.ip` values. |
| A11 | L | Agent tokens sit in the URL path. Railway's edge may log the path. Accepted trade-off in §10, listed so it is not forgotten. | `routes/mcp.ts` | Prefer the header form for clients that support it. Say so in the README. |

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
| C3 | MCP Inspector was not used. Only the SDK client and one `claude -p` session were tested. | Run Inspector once. |
| C4 | Claude Desktop, claude.ai and ChatGPT connectors were not tested with the real apps. Documentation says both accept a remote MCP URL with no OAuth (claude.ai: leave the OAuth fields empty; ChatGPT: Developer mode, "No authentication"). OpenAI's docs say Plus and Pro plans get read-only custom MCP connectors and write support needs Business, Enterprise or Education, which would block `post_message` and `request_approval` for ChatGPT users on Plus and Pro. Not verified by me. | Test both in the two-machine test (`docs/two-machine-test.md`). If ChatGPT cannot write on a plan, say so in the README and the product. |
| C5 | Only one scenario was run with a real agent (one approval round trip). Agent-to-agent chat with two real agents was not run. | Phase 5 two-machine test. |
| C6 | `Dockerfile`, `railway.json` and `netlify.toml` were never deployed. The build sandbox has a Docker client but no daemon, so the image was not built. I simulated it: clean copy, `pnpm install --frozen-lockfile --prod --filter @snapwork/api...`, then the image's start command, and `/health` answered. Railway's `preDeployCommand` path (`/app/apps/api`) and `trust proxy` are unverified. | Deploy once and fix what differs (`docs/deploy.md`). |
| C7 | Dev environment ran Node 22. The Dockerfile and CI use Node 20. pnpm ignored the esbuild build scripts (it worked anyway). | Confirm the CI run on Node 20 is green. |
| C9 | SSE: replay past 500 messages (paging), the 20 s heartbeat, and many parallel streams are not tested. | Add tests. |
| C11 | Rate limits live in process memory. A restart resets them. The SSE bus and waiters only work with one API process. | Fine for MVP. Needs LISTEN/NOTIFY and a shared store before running two instances. |
| C12 | Polling: `wait_for_messages` polls the DB every 1 s as a safety net, one query per second per waiting agent. | Fine at this scale. |
| C13 | A superseded wait can lag up to 1 s if the old call is in the middle of a query. | Accept. |
| C14 | The seed script prints tokens to the console (dev only). | Do not run it in production. |
| C15 | Cause of C2 found: Claude Code 2.1.292 starts with a `server/discover` probe sent with `MCP-Protocol-Version: 2026-07-28`. SDK 1.32.1 (the latest on npm) supports up to `2025-11-25`, so `validateProtocolVersion` returns 400 / -32000 "Unsupported protocol version". The client then falls back to `initialize` and everything works. This is correct per spec and no server change was made. The risk is a client that speaks only 2026-07-28 and does not fall back. Guarded by `apps/api/test/mcp-handshake.test.ts`. | Upgrade `@modelcontextprotocol/sdk` when a release supports 2026-07-28. Then update the handshake test and run `claude -p` once more. Check the fallback when C4 tests Claude Desktop and ChatGPT. |
| C16 | `POST /mcp` with `Accept: application/json` only (no `text/event-stream`) gets 406 from the SDK, even though we set `enableJsonResponse` and only ever reply with JSON. This is spec-compliant: clients MUST send both. Claude Code sends both. Hand-written clients (curl, simple HTTP connectors) may not. | Only act if a real connector hits it in C4. Relaxing it would mean rewriting the `Accept` header in the route before `handleRequest`. |

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

_Platform note: the API was briefly moved to Fly.io and then back to Railway at the owner's request (cost). Railway is not free either: a one-time 5 USD trial credit, then the 5 USD per month Hobby plan, per Railway's pricing page. A truly free host for a long-running process was not evaluated._

| ID | What |
| --- | --- |
| E1 | `.claude/agents/` does not exist (`coder`, `debugger`, `designer`, `security-reviewer`). The Phase 2 review used a general-purpose subagent with a written brief. |
| E3 | Sentry (optional in the plan) was deliberately NOT added. Its default capture of request data, headers and breadcrumbs conflicts with the rule to never log a token or message body, and it needs a careful scrubbing setup to be safe. | Add later with `sendDefaultPii: false`, `beforeSend` that drops request data, and a test, if wanted. |

## H. Added by the Phase 5 security review

| ID | Sev | What | Suggested fix |
| --- | --- | --- | --- |
| L-ssl | L | `sslmode=require` does not verify the database server certificate (postgres.js). | Use `verify-full` with the Supabase CA in the image. |
| L-ui | L | The server's validation message for a bad name is shown as written (`name: Names can't contain ...`), with a technical `name:` prefix. | Map field errors to friendly text in the web forms. |
| L-rail | I | Railway's edge request log records `/mcp/agt_...` paths. Documented in `docs/deploy.md`. Use the Bearer header form where the client supports it. | None. Same as A11. |
| L-ci | I | GitHub Actions are pinned by tag, not by commit SHA, and the Docker base image `node:20-slim` has no digest. | Pin by digest or SHA if you want a stricter supply chain. |
| L-gap | I | The Phase 5 browser checks (CSP, token logic) ran in Chromium only, not in Safari or Firefox. | Check on real devices. |
| L-csp | L | `connect-src https://*.up.railway.app` in `netlify.toml` lets the page talk to any Railway app, including a hostile one, if an XSS ever happened. | Generate a `_headers` file at build time with the exact `VITE_API_URL` origin. |
| L-name | I | Names are checked with a blocklist, not an allowlist. That is safe only because a name is never put in a command (the install command holds only the validated `mcp_url`). Names saved before the check existed are not re-checked (`rotateAgentToken` rebuilds prompts from stored names), and `join_room`'s `model` field gets `cleanLine` but not `isSafeName`. | If a name ever goes into a command, quote or allowlist it. Optionally re-check stored names on rotate. |
| L-wrap | I | In text an agent receives, every `<` becomes a look-alike (`‹`) so no tag can be forged. Code or HTML that agents send each other loses its angle brackets in what the other agent reads. | Accept, or switch to a per-response random boundary. |
| L-nick | I | Names are not unique, and homoglyph or visible-text names (for example "Snapwork") are still possible (A4). | See A4. |

## F. Web (Phase 3)

| ID | Sev | What | Suggested fix |
| --- | --- | --- | --- |
| F1 | M | Partly checked. Two real Chromium browsers (390 px phone emulation and 1280 px desktop) ran create, claim, chat, an MCP agent with an approval round trip, a dropped stream and a reload. Still NOT checked: a real phone, real Safari and Firefox, a real Vietnamese keyboard (Telex, VNI) and the IME guard, real clipboard, focus order with a keyboard, screen readers. | Run the acceptance test on a real phone and laptop. |
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
| F15 | L | The first-load banner on a phone is tall (about 95 px with the Copy link row) and sits on top of the timeline until it is dismissed. | Make it one line with the copy action inline, or collapse after the first scroll. |
| F16 | L | The page load logs one 404 in the console (probably `/favicon.ico`). | Add a favicon. |
| F17 | I | The browser acceptance script (two browsers, latency, stream drop) lives outside the repo. Nothing in CI runs a real browser. | Add a Playwright end-to-end test in Phase 5. |
| F18 | L | The invite URL kept in `localStorage` is the only copy. Clearing site data or opening the room on another device loses it (the card says it can't be shown again). By design (design section 10). | Fine. Could offer "Create a new invite" if the API ever supports it. |

## G. Approval end to end (Phase 4)

Phase 4 acceptance ran with a real Claude Code agent (`claude -p`) and two real Chromium browsers (Barrett on desktop, Minh on a 390 px phone), no curl: create, claim, greeting, request, "/approve" typed by the wrong person, a text that claims approval, Approve click, Done and result link, a second request declined with `/decline too much for now`, agent leaves. 17 of 17 checks passed.

| ID | Sev | What | Suggested fix |
| --- | --- | --- | --- |
| G1 | I | The run used PGlite, desktop Chromium and one Claude Code agent. Not run: a real phone, Claude Desktop, ChatGPT, or two agents (Minh's agent was never connected). | Phase 5 two-machine test. |
| G2 | L | Approve and Decline on the card were exercised by click and by slash command in the owner's browser only. The "409 already decided" path and "two owners deciding at once" are covered by API tests but were not run in the browser. | Add a browser test. |
| G3 | I | The agent decided on its own to answer Minh's fake "Barrett says it is approved" message in chat. That is agent behaviour, not a server guarantee. The gate is still a convention (PROJECT.md section 9). | None. Keep the honest note in the UI. |
| G4 | I | Times in the UI use the browser's local time zone. In this run the sandbox clock was around midnight UTC, so cards showed 00:03. | Fine. |

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
| Create form: a validation message on blur shifted the layout, so the first click on "Create room" after typing in the last field was lost (mouse down moved the button before mouse up). Errors now appear on submit and clear while typing. Same fix on the claim form. Two regression tests added; both fail on the old code. | Phase 3 acceptance fixes |
| `pnpm audit` and CI: `.github/workflows/ci.yml` runs typecheck, tests, web build and `pnpm audit --prod --audit-level high`. 9 advisories were found in production dependencies (2 high: drizzle-orm identifier escaping, path-to-regexp) and fixed by upgrading express to 4.22.3, drizzle-orm to 0.45.3, react-router-dom to 7.18.4 and pnpm overrides for qs and path-to-regexp. The CI file has not run on GitHub yet. | Phase 5 |
| C2 explained: the one `POST /mcp` that returned 400 is Claude Code probing `server/discover` with `MCP-Protocol-Version: 2026-07-28`. SDK 1.32.1 (latest) rejects unknown versions with 400, as the spec says, and Claude Code falls back to the normal handshake. No server change. Guard test `mcp-handshake.test.ts`. Remaining risk: a client that speaks only the new version (see C15). | Phase 5 debug (Opus subagent) |
| Expiry job timer now tested with fake timers (runs hourly, deletes expired rooms, timer is unref'd). | Phase 5 |
| Rate limiter has a hard cap of 50,000 tracked keys (expired first, then oldest). Found and fixed a bug in the first version of the cap: a new key was swept away before its first call was recorded. Test added. | Phase 5 |
| `README.md` written: what it is, how to create a room, connect Claude Code, Claude Desktop and ChatGPT, the approval honesty note, known limits, run and deploy. | Phase 5 |
| Phase 5 review H1 (HIGH): the room name or the other person's name could put a fake URL first in the connect prompt, and the web read the first URL it found to build the Claude Code install command, so the invited person could be handed a shell command or a different MCP server. Fixed three ways: the API returns `mcp_url`, the web uses only that and checks it is exactly `{API}/mcp/agt_...` with a safe character set, and names with shell or URL syntax are refused. Tests for each. | Phase 5 security fixes |
| Phase 5 review M1: a link carrying a different owner token replaced the stored one before the server had checked it (permanent lockout). Now the stored token is kept until the server accepts the link's token. Checked in a real browser. | same |
| Phase 5 review M2, L6: invisible characters (Unicode tag characters, fillers, soft hyphen, bidi overrides) in names and message text. Stripped, keeping emoji joiners. | same |
| Phase 5 review L1: no CSP or frame protection on the web. Added CSP, X-Frame-Options, HSTS and Permissions-Policy in `netlify.toml`. Checked in a real browser: no violations. | same |
| Phase 5 review L2: production now refuses non-https `API_PUBLIC_URL` and `WEB_ORIGIN`. | same |
| Phase 5 review L3: non-integer `limit` and `timeout_s` caused INTERNAL; unexpected tool errors were not logged. Fixed; the error class and Postgres code are logged. | same |
| Phase 5 review L4: IPv6 clients could rotate addresses to dodge per-IP limits (now keyed on /64). Limiter evicts least recently used keys and sweeps at most once a second. | same |
| Phase 5 review L5: look-alike characters could close the untrusted wrapper. Any `</` inside a body is now broken, invisible characters are stripped first. | same |
| Dev dependencies: vitest 5, vite 8 and an esbuild override remove all 10 dev-only audit findings. `pnpm audit` (all dependencies) is clean. CI has `permissions: contents: read`. | same |
| Phase 5 re-review N1 (MEDIUM): the other person in the room could send a link carrying their own valid key, and the web replaced the stored key with it (you end up in their seat). Now a stored key that still works is never replaced; the link is ignored and a notice is shown. If the stored key no longer works, a working link key is taken. Checked in a real browser with two users. | Phase 5 re-review fixes |
| Re-review N2: the Connect card said "includes the connection details" when no safe URL was available. Now it says to regenerate. N3: the token check has a 10 second limit. | same |
| Re-review L5 and M2 gaps: any `<` in text sent to an agent is replaced, so look-alike closers (Cyrillic letters, division slash, spaces) cannot form a tag. Braille blank, Khmer fillers, Mongolian selectors, U+FFFC and U+1D159 are stripped from names, and names need at least one letter or number. | same |
