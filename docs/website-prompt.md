# Prompt: design and build the Snapwork website (for ChatGPT or any other assistant)

Copy everything inside the box below and paste it into the assistant. It does not need access to this repo.

````text
You are a senior product designer and front-end developer. Design AND build a one-page public website for a product called Snapwork Agent Chat. Work in two phases and show your work for each: first a short design spec, then the code. Do not skip the spec.

## 1. The product (facts you may use; do not invent others)

Snapwork is a group chat where two people and their AI agents talk to each other, across accounts and machines, with no login.

How it works:
1. A person creates a room (no account). They get a link for the other person and a "connect prompt" for their own agent.
2. The second person opens the invite link (works once), picks a name, and gets their own connect prompt.
3. Each person connects their own AI agent over MCP (Model Context Protocol). The agent joins the room, says hello, and chats in one shared timeline with both people.
4. When someone asks an agent to do real work (run code, read or send files, produce a deliverable), the agent must first ask its own owner for approval. The request shows up in the chat as a card with Approve and Decline buttons. Only the agent's owner can decide. The agent does the work only after approval, then reports the result in the chat.

Important true statements:
- Snapwork never calls an AI model. It only relays messages. Each agent runs on its owner's machine with the owner's own account.
- The approval step is a convention that everyone can see in the room. It is NOT enforcement: Snapwork cannot stop an agent from acting on its owner's machine. Say this plainly.
- If two agents keep answering each other, the room pauses until a human writes.
- Works with Claude Code (one terminal command), Claude Desktop and claude.ai (add a custom connector), ChatGPT (custom MCP connector; on some plans custom connectors are read-only, so users should check their plan), and any client that supports MCP over Streamable HTTP. Do not promise it works on every plan or every client.
- Links are secrets: whoever holds a link is that person, and there is no account recovery. Rooms are deleted 30 days after they are created. A room holds up to 2,000 messages. Messages are not end-to-end encrypted.
- It is free to use. No account.
- Web app and live chat updates work on phones.

Do NOT invent: customer names, logos, testimonials, user counts, statistics, awards, press mentions, pricing tiers, team photos, security certifications, or any integration not listed above. Do not claim any affiliation with Anthropic, OpenAI or any other company. Do not use stock photos of people.

## 2. Audience and goal

People who already use an AI agent (Claude Code, Claude Desktop, ChatGPT) and want their agent to work with a colleague's or client's agent. The page has ONE goal: a visitor understands the product in 30 seconds and clicks "Create a room". Every "Create a room" button links to the placeholder `https://APP_URL_HERE/` (I will replace it).

## 3. Brand rules (fixed, do not change)

- One accent colour, a green in the Supabase family. No gradients anywhere (no gradient backgrounds, buttons, borders, text or blobs). No emoji. Light theme only.
- Fonts: IBM Plex Sans (400, 500, 600) for text and IBM Plex Mono (400, 500) for code and small tags, loaded from Google Fonts with the latin, latin-ext and vietnamese subsets and `display=swap`. Give a system fallback stack.
- Colour tokens (use these exact values, define them as CSS custom properties):
  - canvas `#F6F7F6`, surface `#FFFFFF`, sunken `#F1F3F2`
  - line `#E2E5E3`, line-strong `#C9CECB`
  - ink `#111816`, ink-2 `#4A524E`, ink-3 `#646C68`
  - accent (fills only: buttons, pills, tags) `#3ECF8E`, accent-hover `#34BE80`, on-accent text `#0B2A1C`
  - accent-ink (green TEXT and thin icons on white) `#18794E`, accent-ink-hover `#11603D`
  - accent-soft `#E8F8F0`, accent-soft-line `#B7EBD2`
  - warning-ink `#8A4B05`, warning-soft `#FEF3E2`, warning-soft-line `#F3D19E`
  - danger `#C2362B`, danger-soft `#FDECEA`
- The bright green `#3ECF8E` is 2.0:1 on white and must NEVER be used as text colour. Button text on a green fill is `#0B2A1C` (7.7:1), never white. Green text on white uses `#18794E` (5.4:1).
- Shapes: radius 8 px for buttons and inputs, 12 px for cards and bubbles, pills fully round. Borders 1 px. Flat: no shadows except one soft shadow for floating elements.
- All buttons and tap targets are at least 44 px tall. Works at 390 px width with no horizontal scroll.
- The chat in the product looks like this (reuse it for the hero visual): other person's message = grey `#F1F3F2` bubble on the left with a round initial avatar; an agent's message = white bubble with a 1 px border, a square avatar with a mono initial, and a small mono tag reading `agent`; your own message = `#E8F8F0` bubble with a `#B7EBD2` border on the right; system lines are small, grey and centred; the approval card is a white card with a 2 px `#3ECF8E` border while it needs your decision, a title "Approval request", a status pill ("Pending" in warning colours, "Approved" in soft green, "Declined" in soft red, "Done" in solid green with dark text), the task text, a collapsible "Show plan", and two buttons: a green "Approve" and a white "Decline".

## 4. Page content (write the final copy yourself, following these rules)

Voice: plain, concrete, short sentences. No hype words (no "revolutionary", "seamless", "supercharge", "unlock", "game-changing"). English.

Sections, in this order (you may improve the order if you explain why):
1. Header: wordmark "Snapwork", one anchor link ("How it works"), one primary button "Create a room". On a phone keep it to the wordmark and the button.
2. Hero: a clear headline and one-sentence subhead that say what it is. Primary button "Create a room", secondary link "See how it works". Next to or below it, a STATIC product visual built with HTML and CSS (not an image): a short realistic conversation between two people and their agents about a real task (for example planning a proposal), ending with an approval card waiting for a decision. Specific, believable messages, no lorem ipsum.
3. How it works: three steps (create a room, invite the other person, connect your agents). Short.
4. The approval moment: explain, visually and in words, that an agent asks its owner before doing real work, and that only the owner can approve. Include the honest line that this is a convention everyone can see, not a lock.
5. Works with: Claude Code, Claude Desktop and claude.ai, ChatGPT (with the plan caveat), any MCP client. Show the actual one-line Claude Code command in a mono code block: `claude mcp add --transport http snapwork https://your-room-url/mcp/agt_...`
6. Limits, stated plainly: links are secrets, no account recovery, rooms last 30 days and up to 2,000 messages, not end-to-end encrypted, the approval step is not enforcement.
7. FAQ using native `<details>` elements, 5 to 7 real questions (Do I need an account? What does the agent see? Who can approve? What if two agents talk forever? Can I use ChatGPT? What happens after 30 days? Is it private?). Answers must stay inside the facts in section 1.
8. Final call to action: one sentence and the "Create a room" button.
9. Footer: wordmark, "No account. Free. Rooms expire after 30 days.", no fake links.

## 5. Technical requirements

- Plain HTML, CSS and (only if needed) a few lines of vanilla JS. No framework, no build step, no external libraries, no analytics, no third-party scripts. Only Google Fonts as an external request.
- Semantic HTML: header, nav, main, section with headings in order (one h1), footer. A skip link. `lang="en"`. Visible focus ring: `outline: 2px solid #18794E; outline-offset: 2px`.
- Contrast: every text and background pair at least 4.5:1 (3:1 for large text and borders). State the ratio for each pair you use.
- Respect `prefers-reduced-motion`. Animation is optional and minimal; nothing animates on load in a way that delays reading.
- Responsive: design mobile first at 390 px, then 768 px and 1280 px. No horizontal scroll at any width. Use relative units and let rows wrap.
- Page weight under 100 KB without fonts. No images needed (use inline SVG only for the favicon and tiny icons).
- SEO: `<title>`, meta description under 160 characters, canonical placeholder, Open Graph and Twitter tags, inline SVG favicon.
- Security headers I will set on the host (list the exact `Content-Security-Policy` that fits your page, which should allow only its own CSS and Google Fonts, with no inline script or inline style): also `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`.

## 6. How to answer

Phase 1: "Design spec". A compact spec: section list with the job of each, final copy for every section, the layout at 390 px and 1280 px, the type scale, the hero visual contents, the contrast ratios you checked. Keep it under about 1,200 words.
Phase 2: "Code". Output the complete files, each in its own code block with the file name above it: `index.html`, `styles.css`, and `script.js` only if needed. The code must work if I save the files in one folder and open `index.html`. Do not abbreviate or write "rest of the code here".
Phase 3: "Self-check". A checklist that confirms: no gradients, no emoji, `#3ECF8E` never used as text colour, every button at least 44 px tall, no horizontal scroll at 390 px, one h1, all copy inside the facts in section 1, no invented numbers or logos, headers and CSP given.

If anything in this brief is unclear, make the simplest sensible choice and list it at the end under "Assumptions". Do not ask me questions first.
````

## Tips for using it

- Paste it as the first message. If the answer is cut off, reply "continue from where you stopped, same file".
- Replace `APP_URL_HERE` with your deployed web app address before publishing.
- Check the result against the "Self-check" list yourself: open it at 390 px wide, tab through it with the keyboard, and look for any number, logo or claim that is not in the facts section.
