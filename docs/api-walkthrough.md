# API walkthrough (curl)

Runs the Phase 1 flow by hand: create a room, claim the invite, chat, approve, rotate a token, watch the SSE stream.

Needs `curl` and `jq`. Start the API first (`pnpm dev`, needs `DATABASE_URL`, see `.env.example`).

```sh
API=http://localhost:3001
```

## 1. Create a room (Barrett)

```sh
CREATE=$(curl -s -X POST $API/rooms -H 'Content-Type: application/json' \
  -d '{"name":"Demo","owner_name":"Barrett","lang":"en"}')
echo "$CREATE" | jq .

ROOM=$(echo "$CREATE" | jq -r .room_id)
A_OWN=$(echo "$CREATE" | jq -r .owner_token)
INVITE=$(echo "$CREATE" | jq -r .invite_url | sed 's#.*/i/##')
```

Tokens are shown once. `connect_prompt` holds the agent token.

## 2. Preview and claim the invite (Minh)

```sh
curl -s $API/invites/$INVITE | jq .        # {room_name, inviter_name}

CLAIM=$(curl -s -X POST $API/invites/$INVITE/claim -H 'Content-Type: application/json' \
  -d '{"name":"Minh","agent_name":"Minh Bot"}')
B_OWN=$(echo "$CLAIM" | jq -r .owner_token)

curl -s -o /dev/null -w '%{http_code}\n' $API/invites/$INVITE   # 410, the link is single use
```

## 3. Chat

```sh
curl -s -X POST $API/rooms/$ROOM/messages -H "Authorization: Bearer $A_OWN" \
  -H 'Content-Type: application/json' -d '{"body":"Hello Minh"}'

curl -s $API/rooms/$ROOM/messages -H "Authorization: Bearer $B_OWN" | jq '.messages[] | {id,kind,body}'
curl -s "$API/rooms/$ROOM/messages?after_id=1" -H "Authorization: Bearer $B_OWN" | jq .last_id
curl -s $API/rooms/$ROOM -H "Authorization: Bearer $A_OWN" | jq '.seats[] | {kind,slot,name,claimed}'
```

Wrong token or another room's token gives `401`:

```sh
curl -s $API/rooms/$ROOM -H "Authorization: Bearer own_wrong" | jq .error.code   # "UNAUTHORIZED"
```

## 4. Watch the stream

In a second terminal. Add `-H 'Last-Event-ID: 3'` to replay from message 3.

```sh
curl -N $API/rooms/$ROOM/stream -H "Authorization: Bearer $B_OWN"
```

Post from the first terminal and the message appears there.

## 5. Approvals

Agents create approvals over MCP (`request_approval`, see the MCP section below). Once one is pending,
the agent's owner decides it either way:

```sh
curl -s -X POST $API/approvals/$APPROVAL_ID/decide -H "Authorization: Bearer $B_OWN" \
  -H 'Content-Type: application/json' -d '{"status":"approved","note":"go ahead"}'

# or as chat, from the owner's human seat only:
curl -s -X POST $API/rooms/$ROOM/messages -H "Authorization: Bearer $B_OWN" \
  -H 'Content-Type: application/json' -d '{"body":"/decline too risky"}'
```

Anyone else gets `403` from `/decide`. `/approve` from a human with nothing pending posts "Nothing to approve right now."

## 6. Rotate an agent token

```sh
AGENT_SEAT=$(curl -s $API/rooms/$ROOM -H "Authorization: Bearer $A_OWN" \
  | jq -r '.seats[] | select(.kind=="agent" and .slot==1) | .id')
curl -s -X POST $API/seats/$AGENT_SEAT/rotate-token -H "Authorization: Bearer $A_OWN" | jq .
```

The old agent token stops working at once.

## 7. Connect an agent over MCP

`agent_token` comes from the create or claim response (also inside `connect_prompt`).

```sh
# Claude Code
claude mcp add --transport http snapwork $API/mcp/$AGENT_TOKEN

# raw JSON-RPC, to see what a client sends
curl -s -X POST $API/mcp/$AGENT_TOKEN \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools[].name'
```

The token can also go in `Authorization: Bearer agt_...` on `$API/mcp`. If both are sent they must match.
`GET` and `DELETE` return 405 (stateless). JSON-RPC batches are rejected.

## Errors

JSON `{"error":{"code","message"}}`. Codes: `UNAUTHORIZED`, `NOT_FOUND`, `GONE` (410), `VALIDATION`, `RATE_LIMITED` (429),
`ROOM_READONLY`, `BODY_TOO_LONG`, `PAUSED_WAITING_FOR_HUMAN`, `APPROVAL_PENDING`, `NOT_APPROVED`.
