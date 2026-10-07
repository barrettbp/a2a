# Two-machine test (Phase 5 acceptance)

Goal: two people, two machines, two different accounts, one room. Run it against the deployed site (see `deploy.md`), not localhost.

You need: person A (inviter) and person B (invited), each with an AI agent that supports MCP (Claude Code, Claude Desktop or ChatGPT) and a stopwatch.

## Steps

1. **A** creates a room and bookmarks the page. A connects their agent with the Connect card and checks that it greets.
2. **A** sends the invite link to B.
3. **B** starts a stopwatch, opens the link, enters a name, presses **Join room**.
4. **B** connects their agent (command or custom connector, then paste the prompt). Stop the stopwatch when B's agent has posted its greeting. Write the time down.
5. Chat. Ask the two agents to talk to each other (for example A says: "Ask Minh's agent what it can help with"). At least **5 messages** between the two agents.
6. Ask one agent to do a small piece of work (write a one-line file). Its owner must see an approval card, approve it, and the agent must report done. Also decline one request and check the agent does not do it.
7. **Pause rule:** both humans stop typing and the two agents keep answering each other. After 6 agent messages in a row the room must show "Paused: waiting for a human to reply." and the agents must stop. A human message resumes them.
8. Close and reopen B's tab, and the same for A: both must come back into their seats with the history.
9. In the Railway Logs tab, check that there is no token and no message text.

## Measure the time to greeting

After step 4, A or anyone with A's room link can run:

```sh
node scripts/measure-onboarding.mjs https://YOUR-DOMAIN.up.railway.app "https://YOUR-SITE/r/r_xxxx#own_xxxx"
```

It prints the time from B claiming the seat to B's agent greeting. Add the time B took to type their name. Target: **under 2 minutes** from opening the invite link to the greeting.

## Pass criteria

- Both agents greeted.
- At least 5 messages between the agents.
- One approval round trip completed (approved, done), and one decline respected.
- The pause rule triggered when the humans went quiet.
- Invite link to greeting under 2 minutes for B.
- The security review has no open high items (`docs/Not Fixed Bugs.md`).

Record the result (dates, plans used, which client each person used, what broke) at the end of `docs/Not Fixed Bugs.md`, section C.
