# Design direction — Snapwork Agent Chat (MVP web)

Owner: designer subagent. Audience: the coder building Phase 3 and Phase 4. Source of truth for scope is `PROJECT.md` §1, §4.1, §9, §11, §12. If this file and `PROJECT.md` disagree on behaviour, `PROJECT.md` wins; this file wins on visuals.

Fixed constraints: light theme only, one accent (Supabase-family green), no gradients anywhere, no emoji, IBM Plex Sans + IBM Plex Mono, 44 px minimum touch targets, works at 390 px wide, UI strings in English, message bodies are plain text.

Breakpoints (Tailwind v4 defaults): mobile `< 768 px` (designed at 390), tablet `md` 768–1023, desktop `lg` ≥ 1024 (designed at 1280).

---

## 1. Foundations

### 1.1 Colour tokens

All colours in the product come from this table. Nothing else, no opacity variants of the accent, no gradients.

| Token | Hex | Use |
| --- | --- | --- |
| `canvas` | `#F6F7F6` | Page background on `/`, `/i/…`, error pages; side panel background; sheet background |
| `surface` | `#FFFFFF` | Cards, inputs, room timeline background, composer, agent bubbles |
| `sunken` | `#F1F3F2` | Other human's bubble, code blocks, plan body, ghost hover, disabled fill |
| `avatar` | `#E9ECEA` | Human avatar fill, secondary pressed |
| `line` | `#E2E5E3` | Card borders, dividers, agent bubble border (decorative, no contrast requirement) |
| `line-strong` | `#C9CECB` | Secondary button border, approval card border, sheet handle |
| `control` | `#7F8984` | Text input / textarea / select border, offline dot (meets 3:1 non-text) |
| `ink` | `#111816` | Primary text |
| `ink-2` | `#4A524E` | Secondary text, labels in pills, icons |
| `ink-3` | `#646C68` | Muted text: timestamps, system messages, helper text, placeholders |
| `accent` | `#3ECF8E` | Fill only: primary button, "Done" pill, pending-for-me card border, unread badge, toast accent icon. Never text or thin icons on white. |
| `accent-hover` | `#34BE80` | Primary button hover |
| `accent-active` | `#2DB574` | Primary button pressed |
| `on-accent` | `#0B2A1C` | Text and icons on any accent fill (white fails, 2.00:1) |
| `accent-ink` | `#18794E` | Green text and thin icons on light backgrounds: links, "to you", "Copied", Approved pill text, focus ring |
| `accent-ink-hover` | `#11603D` | Link hover |
| `accent-soft` | `#E8F8F0` | Flat tint: own bubble, Approved pill, first-load banner, highlight flash, selected To chip |
| `accent-soft-line` | `#B7EBD2` | Border on `accent-soft` surfaces |
| `danger` | `#C2362B` | Danger button fill, error text, failed-message border |
| `danger-hover` | `#A82D23` | Danger button hover/pressed |
| `danger-soft` | `#FDECEA` | Declined pill, form-level error box |
| `danger-soft-line` | `#F5C2BD` | Border on `danger-soft` |
| `warning-ink` | `#8A4B05` | Text on `warning-soft` (Pending pill, paused hint, reconnecting strip) |
| `warning-soft` | `#FEF3E2` | Pending pill, paused hint, reconnecting/offline strip |
| `warning-soft-line` | `#F3D19E` | Border on `warning-soft` |
| `online` | `#249361` | Presence dot "online" (3.87:1 on white, passes 3:1 non-text) |
| `offline` | `#7F8984` | Presence dot "offline"; hollow ring for "waiting for invite" |
| `toast` | `#111816` | Toast background (same value as `ink`) |
| `white` | `#FFFFFF` | Text on `danger` and on `toast` |

Note on the brand green: `#3ECF8E` on white is 2.00:1 and `#1F8A5B` on white is 4.33:1. Both fail AA for normal text, so the text green is `#18794E` (5.41:1).

### 1.2 Measured contrast (WCAG 2.x relative luminance, computed by script)

Text pairs (AA needs 4.5:1 for normal text):

| Foreground | Background | Ratio | Where |
| --- | --- | --- | --- |
| ink `#111816` | surface `#FFFFFF` | 18.01 | body text |
| ink `#111816` | canvas `#F6F7F6` | 16.77 | panel text |
| ink `#111816` | sunken `#F1F3F2` | 16.16 | other human bubble, code |
| ink `#111816` | accent-soft `#E8F8F0` | 16.39 | own bubble, banner |
| ink `#111816` | danger-soft `#FDECEA` | 15.75 | form error box |
| ink-2 `#4A524E` | surface `#FFFFFF` | 8.05 | secondary text |
| ink-2 `#4A524E` | canvas `#F6F7F6` | 7.50 | |
| ink-2 `#4A524E` | sunken `#F1F3F2` | 7.22 | "agent" tag, text in sunken areas |
| ink-2 `#4A524E` | accent-soft `#E8F8F0` | 7.33 | |
| ink-2 `#4A524E` | avatar `#E9ECEA` | 6.77 | avatar initial |
| ink-3 `#646C68` | surface `#FFFFFF` | 5.40 | timestamps, system messages |
| ink-3 `#646C68` | canvas `#F6F7F6` | 5.03 | footer, helper text |
| ink-3 `#646C68` | sunken `#F1F3F2` | 4.85 | time inside sunken areas |
| ink-3 `#646C68` | accent-soft `#E8F8F0` | 4.92 | "Sending…" under own bubble |
| ink-3 `#646C68` | warning-soft `#FEF3E2` | 4.92 | |
| accent-ink `#18794E` | surface `#FFFFFF` | 5.41 | links, "to you", Copied |
| accent-ink `#18794E` | canvas `#F6F7F6` | 5.03 | links in panel |
| accent-ink `#18794E` | sunken `#F1F3F2` | 4.85 | links inside other bubbles |
| accent-ink `#18794E` | accent-soft `#E8F8F0` | 4.92 | links in own bubble, Approved pill |
| accent-ink-hover `#11603D` | surface `#FFFFFF` | 7.60 | link hover |
| accent-ink-hover `#11603D` | accent-soft `#E8F8F0` | 6.92 | |
| on-accent `#0B2A1C` | accent `#3ECF8E` | 7.72 | primary button, Done pill |
| on-accent `#0B2A1C` | accent-hover `#34BE80` | 6.48 | |
| on-accent `#0B2A1C` | accent-active `#2DB574` | 5.85 | |
| white `#FFFFFF` | accent `#3ECF8E` | 2.00 | REJECTED, never use |
| danger `#C2362B` | surface `#FFFFFF` | 5.45 | error text |
| danger `#C2362B` | canvas `#F6F7F6` | 5.07 | |
| danger `#C2362B` | danger-soft `#FDECEA` | 4.76 | Declined pill |
| white `#FFFFFF` | danger `#C2362B` | 5.45 | danger button |
| white `#FFFFFF` | danger-hover `#A82D23` | 6.85 | |
| warning-ink `#8A4B05` | warning-soft `#FEF3E2` | 6.19 | Pending pill, paused hint |
| warning-ink `#8A4B05` | surface `#FFFFFF` | 6.80 | |
| white `#FFFFFF` | toast `#111816` | 18.01 | toast |
| ink-2 `#4A524E` | line `#E2E5E3` | 6.35 | (only if a neutral chip uses `line` fill) |

Do not put `ink-3` on `line` `#E2E5E3` (4.26, fails).

Non-text pairs (WCAG 1.4.11 needs 3:1):

| Element | Colour | Against | Ratio |
| --- | --- | --- | --- |
| Focus ring | `#18794E` | surface | 5.41 |
| Focus ring | `#18794E` | canvas | 5.03 |
| Input border | `#7F8984` | surface | 3.61 |
| Input border | `#7F8984` | canvas | 3.36 |
| Input border | `#7F8984` | sunken | 3.24 |
| Online dot | `#249361` | surface | 3.87 |
| Online dot | `#249361` | canvas | 3.61 |
| Offline dot | `#7F8984` | surface | 3.61 |

The accent fill `#3ECF8E` against white is 2.00:1. That is fine for a button because the label identifies the control; never use the accent alone as the only cue for state (for example, a green dot with no text).

### 1.3 Typography

Google Fonts request (verified: the css2 API serves `latin`, `latin-ext` and `vietnamese` unicode-range blocks for both families with these weights; the browser downloads only the blocks a page uses). Put this in `apps/web/index.html` `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap&subset=latin,latin-ext,vietnamese">
```

(`subset=` is ignored by css2 and harmless; it documents intent. Do not drop `display=swap`.)

Weights used: Sans 400, 500, 600. Mono 400, 500. No italic, no 700.

Font stacks:

- Sans: `"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`
- Mono: `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`

Type scale (size / line height / weight). Mobile applies below 1024 px; desktop at `lg` and up.

| Token | Mobile | Desktop | Use |
| --- | --- | --- | --- |
| `display` | 24 / 32 / 600 | 28 / 36 / 600 | Page title on `/`, `/i/…`, error pages |
| `title` | 18 / 26 / 600 | 18 / 26 / 600 | Card titles, sheet title, dialog title |
| `header` | 16 / 24 / 600 | 16 / 24 / 600 | Room name in header |
| `body` | 16 / 24 / 400 | 15 / 22 / 400 | Message bodies, approval task (500), inputs on mobile |
| `input` | 16 / 24 / 400 | 15 / 22 / 400 | All inputs and textarea. Never below 16 px under 1024 px, or iOS zooms. |
| `label` | 14 / 20 / 500 | 14 / 20 / 500 | Field labels, button text (600), sender names (600), tabs |
| `small` | 14 / 20 / 400 | 14 / 20 / 400 | Plan text, card body, people rows subline |
| `caption` | 13 / 18 / 400 | 13 / 18 / 400 | Helper text, system messages, "to Minh", owner subline |
| `micro` | 12 / 16 / 500 | 12 / 16 / 500 | Timestamps (400), pills (600), "agent" tag (mono 500) |
| `code` | 13 / 20 / 400 mono | 13 / 20 / 400 mono | Install line, URL, connect prompt, invite link |

Letter spacing 0 everywhere. No all-caps. Numbers in counters use `font-variant-numeric: tabular-nums`.

### 1.4 Spacing, radii, borders, shadows

Spacing scale (px): 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Page side gutter 16 on mobile, 24 on desktop.

Radii:

| Token | px | Use |
| --- | --- | --- |
| `radius-xs` | 4 | "agent" tag, grouped bubble inner corner |
| `radius-sm` | 8 | Buttons, inputs, code blocks, toast, agent avatar |
| `radius-md` | 12 | Cards, bubbles, dialog |
| `radius-lg` | 16 | Bottom sheet top corners |
| `radius-full` | 9999 | Pills, dots, human avatars, jump button |

Borders: always 1 px solid, colour from tokens. The only 2 px borders: the focus ring and the "pending, needs your decision" approval card.

Shadows: flat by default. Only floating layers get a shadow, and only this one:

- `shadow-overlay`: `0 8px 24px rgba(17, 24, 22, 0.12), 0 1px 2px rgba(17, 24, 22, 0.08)` for bottom sheet, tablet overlay panel, dialog, toast, jump button.
- Scrim behind sheet and dialog: `rgba(17, 24, 22, 0.40)` flat.

### 1.5 Focus ring

All interactive elements: `:focus-visible { outline: 2px solid #18794E; outline-offset: 2px; }`. No ring on mouse click (`:focus:not(:focus-visible)` has no outline).

Inputs, textarea and select: no offset outline; instead on focus the border becomes `#18794E` and `box-shadow: 0 0 0 1px #18794E` (reads as a 2 px green border). Error state keeps the same pattern in `#C2362B`.

Why not the bright green: `#3ECF8E` is 2.00:1 on white and fails 3:1 for a focus indicator.

### 1.6 Icons

Hand-written inline SVG, no icon library. 24×24 viewBox, drawn at 20 px, `stroke="currentColor"`, stroke width 1.75, round caps and joins, no fill. Set needed: copy, check, chevron-down, x (close), users (people), arrow-down (jump), arrow-up (send), alert-circle, refresh (retry/reconnecting), link. Icon-only buttons always have `aria-label`.

---

## 2. Components

All buttons are 44 px tall (both breakpoints), padding 0 16, radius 8, `label` type at weight 600, gap 8 between icon and text. Icon-only buttons are 44 × 44. Transitions: `background-color, border-color, color 120ms linear; transform 100ms ease-out`. `:active` adds `transform: scale(0.98)` (removed under reduced motion).

### 2.1 Buttons

| Variant | Default | Hover | Active | Disabled |
| --- | --- | --- | --- | --- |
| Primary | bg `#3ECF8E`, text `#0B2A1C`, no border | bg `#34BE80` | bg `#2DB574` | bg `#F1F3F2`, text `#7F8984`, `cursor: not-allowed` |
| Secondary | bg `#FFFFFF`, 1 px `#C9CECB`, text `#111816` | bg `#F1F3F2` | bg `#E9ECEA` | bg `#FFFFFF`, border `#E2E5E3`, text `#7F8984` |
| Ghost | transparent, text `#4A524E` | bg `#F1F3F2`, text `#111816` | bg `#E9ECEA`, text `#111816` | text `#7F8984` |
| Danger | bg `#C2362B`, text `#FFFFFF` | bg `#A82D23` | bg `#A82D23` | same as primary disabled |

Disabled colours are exempt from contrast rules and are meant to look inactive.

Focus: the global ring (1.5).

Loading: the button keeps its width (set `min-width` to the measured idle width), shows a 16 px spinner (2 px ring in `currentColor`, 25 % segment, rotate 700 ms linear infinite; under reduced motion no rotation, show the static ring) to the left of a loading label, sets `aria-busy="true"` and `disabled`. Loading labels: "Creating room…", "Joining…", "Regenerating…", "Approving…", "Declining…".

Error: buttons do not have an error look. Errors show as inline text next to the action or as a toast (see each screen).

### 2.2 Text input

- Height 44, padding 0 12, radius 8, bg `#FFFFFF`, border 1 px `#7F8984`, text `input` in `#111816`, placeholder `#646C68`.
- Label above: `label` type `#111816`, 6 px gap. Optional fields append " (optional)" in `#646C68` weight 400.
- Helper text below: `caption` `#646C68`, 6 px gap.
- Hover: border `#4A524E`.
- Focus: border `#18794E` + `box-shadow: 0 0 0 1px #18794E`.
- Error: border `#C2362B` + `box-shadow: 0 0 0 1px #C2362B` when focused; message below in `caption` `#C2362B` with alert-circle icon 16 px; `aria-invalid="true"` and `aria-describedby` pointing to the message. Validate on blur and on submit, never on each keystroke.
- Disabled / read-only: bg `#F1F3F2`, border `#E2E5E3`, text `#4A524E`.
- `maxLength` set on the element (names 60, room name 80) so typing can't exceed it.

### 2.3 Composer textarea

- Container: `surface` bg, top border 1 px `#E2E5E3`, padding 8 16 (mobile) / 12 24 (desktop), plus `padding-bottom: calc(8px + env(safe-area-inset-bottom))` on mobile. Sticky to the bottom of the main column.
- Inner layout: row 1 = To picker (2.4) on the left, character counter on the right (only when shown). Row 2 = textarea + Send button, 8 px gap, aligned to the bottom.
- Textarea: min height 44, auto-grows with content up to 160 px (mobile) / 240 px (desktop), then scrolls inside. Radius 8, border 1 px `#7F8984`, padding 10 12, text `input`. Placeholder "Write a message". `aria-label="Message"`. Height change is instant, never animated.
- Send: primary icon button 44 × 44 with arrow-up icon, `aria-label="Send"`. Disabled (primary disabled style) when the trimmed text is empty, over 4000 characters, or the room is read-only.
- The textarea is never disabled during a send. On send: capture value, clear the field, keep focus, push the optimistic message. If the send fails, the message stays in the timeline as failed (3.6); the text is not put back into the field.
- Character counter: hidden until 3500 characters. Then `micro` 400 `#646C68`, "3,812 / 4,000". Over 4000: `#C2362B`, "4,013 / 4,000. Shorten the message to send it."
- Paused hint (room `paused = true`): a strip above row 1, inside the composer, bg `#FEF3E2`, 1 px `#F3D19E`, radius 8, padding 8 12, `caption` `#8A4B05`: "Paused: your message will resume the agents." Disappears when a `seat`/room update reports `paused = false`.
- Read-only room: the composer is replaced by a 56 px bar, bg `#F1F3F2`, `caption` `#4A524E` centred: "This room reached its 2,000-message limit and is read-only."

### 2.4 Select / To picker

Native `<select>` (good on phones, accessible for free), styled:

- Height 44, radius 8, padding 0 32 0 12, chevron-down icon 16 px at right 10 px (`pointer-events: none`), text `label` weight 500.
- Visible text: "To: Everyone". `aria-label="Send to"`.
- Default (Everyone): transparent bg, no border, text `#4A524E`; hover bg `#F1F3F2`.
- A person selected: bg `#E8F8F0`, 1 px `#B7EBD2`, text `#18794E`, visible text "To: Minh". This makes an addressed send impossible to miss.
- Options, in this order, excluding yourself and unclaimed seats: "Everyone", "{other human}", "{your agent name} (your agent)", "{other agent name} ({owner}'s agent)".
- Selection is sticky across sends (so you can keep talking to one agent). It resets to Everyone if the chosen seat disappears.
- Generic `<select>` in forms (none needed in MVP) uses the text input styles.

### 2.5 Copy button

- Secondary button, icon copy + text "Copy" (or the specific label: "Copy link", "Copy prompt", "Copy command").
- Copied state, 1500 ms: icon becomes check, text becomes "Copied", text and icon `#18794E`, border stays. Icon swap is a 120 ms opacity crossfade. Width is locked so the label change does not shift layout.
- Announce with a shared visually hidden `aria-live="polite"` region: "Copied to clipboard."
- Failure (`navigator.clipboard` rejects): select the text in the adjacent code block and show toast "Couldn't copy. The text is selected, copy it manually."

### 2.6 Tabs (Connect card)

- Labels: "Claude Code", "Claude Desktop and ChatGPT", "Other MCP".
- Tablist: full width, 3 equal columns, bottom border 1 px `#E2E5E3`. Each tab min-height 44 (52 on mobile where the middle label wraps to two lines), padding 8, text `label` 500 centred, wraps allowed.
- Inactive: text `#4A524E`, hover bg `#F1F3F2`.
- Active: text `#111816` weight 600, 2 px bottom bar `#3ECF8E` sitting on the tablist border. The bar moves instantly (no sliding indicator).
- Focus: global ring, inset (`outline-offset: -2px`) so it is not clipped.
- Keyboard: WAI-ARIA tabs pattern. Left/Right move and activate, Home/End jump. `role="tablist"`, `role="tab"` with `aria-selected`, `aria-controls`; panels `role="tabpanel"`.
- Remember the last chosen tab in `localStorage` (`snapwork:connect-tab`), wrapped in try/catch.

### 2.7 Status pill

Height 24, padding 0 8, radius full, `micro` weight 600, 1 px border. Text always present (colour is never the only signal).

| Status | Text | Bg | Border | Text colour | Ratio |
| --- | --- | --- | --- | --- | --- |
| pending | "Pending" | `#FEF3E2` | `#F3D19E` | `#8A4B05` | 6.19 |
| approved | "Approved" | `#E8F8F0` | `#B7EBD2` | `#18794E` | 4.92 |
| declined | "Declined" | `#FDECEA` | `#F5C2BD` | `#C2362B` | 4.76 |
| done | "Done" | `#3ECF8E` | `#3ECF8E` | `#0B2A1C` | 7.72 |

Status change: `background-color, border-color, color` 150 ms linear. Text swaps instantly. No scale, no bounce.

### 2.8 "agent" tag

Inline, height 18, padding 0 6, radius 4, bg `#F1F3F2`, 1 px `#E2E5E3`, text "agent" in IBM Plex Mono 12 / 16 / 500, `#4A524E` (7.22:1). Lowercase. Sits 6 px after the agent's name, vertically centred. Not interactive.

### 2.9 Presence dot

8 × 8 circle, always paired with a text status (never alone).

- Online (`last_seen_at` < 90 s): filled `#249361`.
- Offline / last seen: filled `#7F8984`.
- Waiting for invite / not connected yet: hollow, 1.5 px ring `#7F8984`, transparent centre.

No pulse, no animation. Recompute every 15 s from `last_seen_at` and on every `seat` SSE event; the dot and text change instantly.

### 2.10 Avatars

- Human: 32 × 32 circle, bg `#E9ECEA`, initial (first letter of name, uppercased) `label` 600 `#4A524E`.
- Agent: 32 × 32 square with radius 8, bg `#FFFFFF`, 1 px `#C9CECB`, initial in IBM Plex Mono 13 / 500 `#4A524E`.
- Shape is the second cue for agent vs human (the tag is the first). No colour per person.
- People list uses the same avatars at 32 px.

### 2.11 Toast

- Position: fixed, horizontally centred, bottom = composer height + 16 px (room) or 24 px (other pages). Max width `min(360px, 100vw - 32px)`. One toast at a time; a new one replaces the old.
- Bg `#111816`, text `#FFFFFF` `small`, radius 8, padding 12 16, `shadow-overlay`. Optional action as a text button in `#3ECF8E` (9.02:1 on `#111816`) weight 600, 44 px tall hit area.
- `role="status"` (`aria-live="polite"`). Info toasts dismiss after 3000 ms; error toasts after 6000 ms; hovering or focusing pauses the timer.
- Enter: opacity 0→1 and translateY 8 px→0, 180 ms `cubic-bezier(0.2, 0, 0, 1)`. Exit: opacity 1→0, 150 ms linear.

### 2.12 Collapsible plan

- Trigger: ghost button, 44 tall, left-aligned, text "Show plan" / "Hide plan", chevron-down 16 px after the text that rotates 180° when open. `aria-expanded`, `aria-controls`.
- Body: bg `#F1F3F2`, radius 8, padding 12, `small` `#111816`, `white-space: pre-wrap`, `overflow-wrap: anywhere`, same autolink rule as messages. Max height 320 px with internal scroll for very long plans.
- Open/close: wrapper uses `display: grid; grid-template-rows: 0fr → 1fr` with `transition: grid-template-rows 200ms cubic-bezier(0.2, 0, 0, 1)`; chevron rotate 200 ms same curve. Inner element `overflow: hidden; min-height: 0`.
- No plan supplied: no trigger, show `caption` `#646C68` "No plan given."

### 2.13 Confirm dialog (Regenerate)

- `role="alertdialog"`, `aria-modal="true"`, labelled by its title, described by its body. Use native `<dialog>` with `showModal()`.
- Size: width `min(420px, 100vw - 32px)`, bg `#FFFFFF`, radius 12, padding 24, `shadow-overlay`, scrim `rgba(17,24,22,0.40)`.
- Title `title`: "Regenerate connect prompt?"
- Body `small` `#4A524E`: "Your agent's current connection stops working right away. You will need to run the new install line and paste the new prompt into your agent."
- Actions, right-aligned on desktop, full-width stacked on mobile (danger on top): secondary "Cancel", danger "Regenerate". Initial focus on "Cancel". Esc and scrim click cancel. Focus returns to the "Regenerate connect prompt" trigger.
- While the request runs: danger button loading "Regenerating…", Cancel disabled, Esc ignored. On error: dialog stays open, inline `caption` `#C2362B` above actions: "Couldn't regenerate. Check your connection and try again."
- Enter: opacity 0→1, scale 0.98→1, 160 ms `cubic-bezier(0.2, 0, 0, 1)`; scrim opacity 160 ms. Exit: opacity 120 ms linear.

### 2.14 Bottom sheet (mobile) and side panel (desktop)

The same content (section 5.2 "Panel") renders in three containers:

- Desktop `lg+`: static right column, width 360, bg `#F6F7F6`, left border 1 px `#E2E5E3`, full height under the header, scrolls independently, padding 16. No open/close; no animation.
- Tablet `md`: overlay panel from the right, width 360, `shadow-overlay`, scrim. Toggled by the header "People" button. Enter translateX 100%→0, 240 ms `cubic-bezier(0.32, 0.72, 0, 1)`; exit 180 ms `cubic-bezier(0.4, 0, 1, 1)`.
- Mobile: bottom sheet. Width 100 %, max height `90dvh`, bg `#F6F7F6`, top radius 16, `shadow-overlay`, scrim. Top: 36 × 4 handle `#C9CECB` radius full, 8 px from top (decorative; drag-to-dismiss not required). Header row 56 px: title "Room" (`title`), close icon button 44 × 44 `aria-label="Close"`. Content scrolls; `overscroll-behavior: contain`; padding 0 16 `calc(16px + env(safe-area-inset-bottom))`. Enter translateY 100%→0, 280 ms `cubic-bezier(0.32, 0.72, 0, 1)`; exit 200 ms `cubic-bezier(0.4, 0, 1, 1)`; scrim opacity 200 ms.
- Overlay variants: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` the title, focus trapped, Esc and scrim tap close, focus returns to the trigger. Body scroll locked while open.

Panel cards (inside any container): bg `#FFFFFF`, 1 px `#E2E5E3`, radius 12, padding 16, 12 px gap between cards. Card title `title`; collapsible cards use a full-width header button (44+ px) with chevron.

---

## 3. Chat timeline

### 3.1 Layout

- Timeline background `#FFFFFF`. One column. Inner content max width 720 px, centred in the main column, side padding 16 (mobile) / 24 (desktop), 16 px top padding, 16 px bottom padding above the composer.
- Others' messages align left with a 32 px avatar column and 8 px gap. Own human messages align right with no avatar and no name.
- Bubble max width: 85 % of the column on mobile, 560 px on desktop. Approval cards: full column width up to 600 px, left aligned with the avatar column.
- Day divider before the first message of each local day: centred `micro` 400 `#646C68`, 1 px `#E2E5E3` line on both sides, 16 px vertical margin. Labels: "Today", "Yesterday", otherwise "Mon 5 Oct" (`Intl.DateTimeFormat`, English, weekday short, day numeric, month short).

### 3.2 Message anatomy

Header line (first message of a group, others only): name (`label` 600 `#111816`), for agents the "agent" tag, then time (`micro` 400 `#646C68`, `HH:mm` local 24 h, inside `<time datetime="…" title="full date and time">`). 4 px gap to the bubble.

Subline (agents only, under the name, same group header): `caption` `#646C68` "{owner_name}'s agent", or "Your agent" when the owner is me. If the message is addressed, the subline continues " · to Minh" (see 3.4). Humans have no subline unless the message is addressed, in which case the subline is just "to Minh".

Bubble: radius 12, padding 8 12, `body` text, `white-space: pre-wrap`, `overflow-wrap: anywhere`, `word-break: normal`.

| Sender | Align | Bubble bg | Border | Avatar |
| --- | --- | --- | --- | --- |
| Other human | left | `#F1F3F2` | none | human circle |
| Any agent (including mine) | left | `#FFFFFF` | 1 px `#E2E5E3` | agent square |
| Me (human) | right | `#E8F8F0` | 1 px `#B7EBD2` | none |

Agent bubbles being white with a border plus the mono "agent" tag plus the square avatar make agents identifiable at a glance without a second colour.

### 3.3 Grouping

Consecutive `chat` messages group when they have the same sender, the same addressee, nothing else in between, and are less than 5 minutes apart.

- Grouped messages drop the avatar, header and subline. Avatar shows on the first message of the group (aligned to its top).
- 4 px between bubbles in a group, 16 px between groups, 24 px around approval cards and system messages.
- Corner shaping: first bubble keeps radius 12 except the corner nearest the avatar side (top-left for others, top-right for me) which is 4 px; subsequent bubbles in the group use 4 px on that whole side. Purely radius changes, no tails.
- Own messages: time and send status appear once, under the last bubble of the group, right-aligned, `micro` 400 `#646C68`.
- Other people's grouped messages show the time only in the header. On hover (pointer: fine) a grouped bubble shows its own time at the right of the row in `micro` `#646C68`, opacity transition 120 ms. Touch devices do not show per-bubble times.

### 3.4 Addressed messages

- To someone else: subline shows "to Minh" (`caption` `#646C68`). For my own messages a "to Minh" line sits above the bubble, right-aligned, `caption` `#646C68`.
- To me: subline shows "to you" in `caption` weight 600 `#18794E`. No other emphasis.
- Name used: the seat's display name (human name or agent name). Agents addressed show the agent's name, e.g. "to Claude".

### 3.5 System messages

Centred, max width 480, `caption` `#646C68`, no bubble, no avatar, 8 px vertical padding. Text is the server body as-is (it follows `room.lang`). Examples: "Minh joined the room.", "Paused: waiting for a human to reply.", "Nothing to approve right now." Not grouped. No timestamp shown; the `<time>` stays in the DOM with `title` for hover.

`approval_decision` messages render as a system-style centred line built from structured data, never from the body: "{owner} approved the request from {agent}." / "{owner} declined the request from {agent}." followed by a link "View request" (`accent-ink`) that scrolls to the card. If a note exists: second line `caption` `#4A524E`: "Note: {note}".

### 3.6 Optimistic send states

Each outgoing message gets a client id (`crypto.randomUUID()`) used as the React key for its whole life, so confirmation never remounts the row.

1. Sending: appears immediately at the bottom with entrance motion (8.2). Its status line shows nothing for the first 600 ms; if the POST has not resolved by then, it shows "Sending…" in `#646C68`. Bubble looks normal (no opacity change; dimming causes flicker).
2. Sent: the POST response gives the server `id`; store it on the same item. Status line shows the time. If the SSE `message` event with that `id` arrives first, the reducer matches it to the pending item (same sender seat, same body, pending) and merges into it instead of appending. Dedupe all messages by server `id`. Ordering of confirmed items is by `id`; pending items stay after all confirmed items.
3. Failed (network error, 5xx, `RATE_LIMITED`, `ROOM_READONLY`, `BODY_TOO_LONG`): bubble border becomes 1 px `#C2362B`. Status line, right-aligned, `micro`: alert-circle 14 px + "Not sent." in `#C2362B`, then two text buttons with 44 px tall hit areas: "Retry" (`#18794E` 600) and "Discard" (`#4A524E` 600). Retry reuses the same client id and returns to "Sending". For `RATE_LIMITED` the text is "Not sent. Too many messages, wait a moment." For `ROOM_READONLY`, the composer switches to read-only too.

### 3.7 Scroll behaviour and "New messages" button

- "At bottom" means within 120 px of the bottom.
- When at bottom, new messages keep the view pinned to the bottom (set `scrollTop` after layout in a `useLayoutEffect`; never animate this).
- When I send, always jump to bottom: instant if more than one viewport away, otherwise `behavior: "smooth"` (instant under reduced motion).
- When not at bottom and new messages from others arrive: show the jump button. Pill, height 44, padding 0 16, bg `#FFFFFF`, 1 px `#C9CECB`, `shadow-overlay`, text `label` 600 `#18794E` with arrow-down icon: "1 new message" / "{n} new messages". Position: centred, 12 px above the composer. Tap scrolls to the first unseen message (smooth, or instant under reduced motion) and hides the button. It also hides when the user scrolls to the bottom. Enter/exit: opacity + translateY 8 px, 160 ms.
- If the user is not at bottom and there are no unseen messages, no button (no generic "scroll to bottom" button in MVP).
- Initial load: render at the bottom with no animation and no visible scroll jump (set scroll position before first paint).

### 3.8 Message text rules

- Plain text only. No markdown, no HTML. Render the body as text nodes; the only elements created are `<a>` for URLs and nothing else.
- Autolink: `https?://` URLs only (no bare domains, no `javascript:`, no `mailto:`). Strip trailing `.,;:!?)]}'"` from the match unless balanced by an opening bracket inside the URL. Links: `#18794E`, underline 1 px, `text-underline-offset: 2px`; hover `#11603D`; `target="_blank" rel="noopener noreferrer"`.
- Long unbroken strings and URLs: `overflow-wrap: anywhere` on the bubble so a 300-character URL wraps inside the bubble at 390 px. Never horizontal scroll.
- Long messages (up to 4000 chars): shown in full, no "read more". Line breaks preserved by `pre-wrap`.
- Vietnamese text renders in IBM Plex Sans with the `vietnamese` subset; diacritics need the 24 px line height on mobile, do not tighten it.

### 3.9 `result` messages

Agent bubble as usual, with a first line inside the bubble, above the body: a link row "Done · {task, truncated to 60 chars with …}" in `caption` 600 `#18794E`, preceded by a 14 px check icon. Activating it scrolls to the approval card and flashes it (8.2). 8 px gap to the body.

---

## 4. Approval card

Rendered for `approval_request` messages, using `meta.approval_id`, `meta.task`, `meta.plan` and the live approval status from `GET /rooms/:id` `pending_approvals` plus `approval` SSE events.

### 4.1 Layout

Left aligned, avatar column shows the agent's square avatar. Card: bg `#FFFFFF`, 1 px `#C9CECB`, radius 12, padding 16, width 100 % up to 600 px.

1. Top row: left "Approval request" `label` 600 `#4A524E`; right the status pill (2.7).
2. Who: `caption` `#646C68`: "{agent_name} asks {owner_name}" (or "{agent_name} asks you" when I am the owner), then " · HH:mm".
3. Task: `body` weight 500 `#111816`, pre-wrap, autolinked. 8 px above, 4 px below.
4. Plan: collapsible (2.12). Default collapsed, except expanded on the owner's own card while pending.
5. Footer (depends on state and viewer, below). 12 px above.

### 4.2 States by viewer

The owner of the requesting agent ("me" = `approval.owner_seat_id`):

- Pending: card border 2 px `#3ECF8E` (padding 15 to keep size). Label above actions `caption` 600 `#111816`: "Needs your decision". Actions: primary "Approve" and secondary "Decline". Mobile: side by side, each 50 % minus 4 px gap. Desktop: auto width, left aligned, 8 px gap. Under the actions, `caption` `#646C68`: "Snapwork can't stop your agent from acting. Approving is how you tell it to go ahead."
- Click Approve or Decline: optimistic. Pill switches immediately; the clicked button shows loading and both are disabled. On success the actions area is replaced by the decided footer. On failure: revert pill to Pending, re-enable buttons, toast "Couldn't save your decision. Try again." A `409`/already-decided response just renders the server's status.
- No note field on the card. Notes remain available through `/decline note`.

Everyone else (other human, or anyone viewing a card not addressed to them):

- Pending: no buttons. Footer `caption` `#646C68`: "Waiting for {owner_name} to decide."

Decided (all viewers):

- Approved: footer `caption` `#4A524E`: "Approved by {owner_name or 'you'} · HH:mm". Border back to 1 px `#C9CECB`.
- Declined: "Declined by {owner_name or 'you'} · HH:mm", then on its own line "Note: {note}" if present.
- Done: "Done · HH:mm · " followed by link "See result" (`#18794E`) that scrolls to the `result` message and flashes it.

The card height changes when actions are replaced by the footer. That change is instant (no height animation) and happens in place; the timeline does not jump because cards above the viewport bottom keep their position (if the card is the last item and the user is at bottom, stay pinned).

### 4.3 The honesty note

Two places, same wording family, plain, no warning colours:

- On the owner's pending card (above).
- In the panel, card "How approvals work" (5.2).

Never say "blocked", "enforced", "secured" or "prevented" about approvals.

---

## 5. Screens

Global page rules: `<html lang="en">`, viewport meta `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`. Use `100dvh`, not `100vh`. `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation` on buttons. Body bg per screen. Text selection allowed in messages and code blocks, disabled on buttons.

Loading rule everywhere: show a loading state only if the request takes longer than 300 ms; skeleton blocks are static `#F1F3F2` rectangles with radius 8, no shimmer.

### 5.1 `/` Create room

Mobile (390): bg `#F6F7F6`. Single column, gutter 16, top padding 40.

- Wordmark "Snapwork" `title` `#111816`. 8 px below: `small` `#4A524E` "A group chat for two people and their AI agents."
- 32 px gap. Title `display`: "Create a room".
- 24 px gap. Form, 20 px between fields:
  - "Room name", placeholder "Proposal for Acme", maxLength 80, required.
  - "Your name", placeholder "Your first name", maxLength 60, required, `autocomplete="given-name"`.
  - "Your agent's name (optional)", placeholder live-updates to "{name}'s agent" from the Your name field ("Your agent" while name is empty), maxLength 60. Helper: "Your agent can change this when it joins."
  - "Language": two-option segmented control (radio group), full width, 44 tall, 1 px `#7F8984` outer border radius 8; options "English" and "Tiếng Việt". Selected: bg `#E8F8F0`, text `#18794E` 600; unselected: bg `#FFFFFF`, text `#4A524E`. Implement as `<fieldset>` with two visually styled radios; arrow keys switch. Helper: "Used for greetings and system messages. The app stays in English."
- 24 px gap. Primary button "Create room", full width.
- 24 px gap. Footer `caption` `#646C68` centred: "No account. Free. Rooms expire after 30 days."

Desktop: bg `#F6F7F6`. Centred card width 440, bg `#FFFFFF`, 1 px `#E2E5E3`, radius 12, padding 32, top margin 96. Wordmark and pitch sit above the card, left-aligned to it. Button full card width. Footer under the card.

States:

- Idle: button enabled always; validation runs on submit.
- Validation errors: "Enter a room name." / "Enter your name." Focus moves to the first invalid field.
- Submitting: button "Creating room…" loading; fields stay editable but submit is ignored.
- Rate limited (429): form-level error box above the button, bg `#FDECEA`, 1 px `#F5C2BD`, radius 8, padding 12, `small` `#111816` with alert icon in `#C2362B`: "Too many rooms were created from this network. Try again in an hour."
- Network / 5xx: same box: "Couldn't reach Snapwork. Check your connection and try again."
- Success: store `owner_token`, `invite_url`, `connect_prompt`, `agent_token` in memory; store `owner_token` in `localStorage` keyed by room id (see 5.2 for `invite_url`); navigate to `/r/{room_id}#{owner_token}` with the panel open on mobile.
- Offline (`navigator.onLine === false`): button stays enabled; on submit show the network error. No separate offline screen.

### 5.2 `/r/:room_id` Room

#### Structure

Mobile (390):

```
┌ header 56 ─────────────────────────────┐
│ Room name (truncate)        [People •] │
├ banner (first load only) ──────────────┤
├ reconnect strip (overlay, when needed) ┤
│ timeline (scrolls)                     │
│                                        │
├ composer (sticky) ─────────────────────┤
│ [To: Everyone v]                       │
│ [ Write a message          ] [ ^ ]     │
└────────────────────────────────────────┘
```

Desktop (1280):

```
┌ header 56 (full width) ─────────────────────────────────────────────┐
├ banner (main column only) ────────────────────────┬─────────────────┤
│ timeline, content max 720 centred                 │ panel 360       │
│                                                   │ People          │
│                                                   │ Invite          │
├ composer, max 720 centred ────────────────────────┤ Connect agent   │
│                                                   │ How approvals…  │
└───────────────────────────────────────────────────┴─────────────────┘
```

Whole page is `100dvh`, no body scroll; timeline and panel scroll independently.

#### Header

Height 56, bg `#FFFFFF`, bottom border 1 px `#E2E5E3`, padding 0 16 (mobile) / 0 24 (desktop).

- Left: room name `header` `#111816`, single line, ellipsis. Under it only when not live: connection label (see Connection states). Wordmark "Snapwork" in `label` 600 `#4A524E` sits left of the room name on desktop only, separated by a 1 px × 20 px `#E2E5E3` divider.
- Right (mobile and tablet): secondary button with users icon and text "People". An 8 px `#3ECF8E` dot with 2 px white ring at its top-right corner when something needs attention (invite not claimed yet, my agent never connected, or a pending approval addressed to me while the panel is closed); the button's `aria-label` adds ", needs attention". Desktop: no button.

#### First-load banner

Shown when the owner token came from the URL fragment and was not yet in `localStorage` for this room (i.e. first open on this device), until dismissed. Dismissal stored in `localStorage` (`snapwork:banner-dismissed:{room_id}`).

- Full width of the main column, bg `#E8F8F0`, bottom border 1 px `#B7EBD2`, padding 12 16, `small` `#111816`: "Bookmark this link. It is the only way back into your seat."
- Actions on the right (mobile: wrap below the text, left aligned): secondary "Copy link" (copies the full URL including `#token`), ghost icon button close `aria-label="Dismiss"`.
- Not dismissed by scrolling. Appears without animation on load; dismiss removes it instantly.

#### Timeline states

- Loading (> 300 ms): five static skeleton rows alternating left/right, heights 40/56/40/72/40, widths 60/45/70/50/40 %.
- Empty (no messages at all): centred block, max width 320, `small` `#4A524E`:
  - Title `label` 600 `#111816`: "No messages yet"
  - For the creator while invite unclaimed: "Invite the other person and connect your agent. Your agent will say hello when it joins." Buttons (mobile only, desktop has the panel visible): secondary "Invite" and secondary "Connect your agent", both open the sheet scrolled to that card.
  - For everyone else: "Connect your agent. It will say hello when it joins."
- Populated: section 3.
- Load error (5xx / network): centred, alert icon `#C2362B`, `label` 600 "Couldn't load this room." `small` `#4A524E` "Check your connection." Secondary button "Try again".
- `401` (no token in fragment and none stored, or token rejected): full-page error (5.4) "You don't have access to this seat."
- `404` room: 404 page. `410` room gone: 410 page "This room is gone."

#### Composer

As 2.3 and 2.4. Desktop: on load focus the textarea. Mobile: never autofocus (keeps the keyboard closed).

Keys: Enter sends; Shift+Enter inserts a newline. Do not send while an IME composition is active (`event.isComposing` or `keyCode === 229`); Vietnamese Telex/VNI input relies on this. Ctrl/Cmd+Enter also sends.

#### Panel content (desktop column, tablet overlay, mobile sheet)

Order: People, Invite (only while H2 unclaimed and I am H1), Connect your agent, How approvals work.

After create on mobile, and after claim on any size: the panel opens (sheet on mobile) with the Connect card expanded and its heading focused.

**People** (card title "People")

Four rows, 56 px each, avatar 32, 12 px gap, name `label` 600, subline `caption` `#646C68` with presence dot (2.9) before the text. Order: me, my agent, other human, other agent.

| Seat state | Name line | Subline |
| --- | --- | --- |
| Me | "{name}" + " (you)" in `#646C68` 400 | dot online, "Online" |
| Human online | "Minh" | dot online, "Online" |
| Human seen | "Minh" | dot offline, "last seen 3 min ago" |
| Agent online | "Claude" + agent tag | dot online, "Online · Your agent" / "Online · Minh's agent" |
| Agent seen | "Claude" + agent tag | dot offline, "last seen 3 min ago · Minh's agent" |
| Agent claimed, never joined | "{agent_name or 'Your agent'}" + agent tag | hollow dot, "Not connected yet" |
| H2 / A2 unclaimed | "Invited person" / "Their agent" in `#646C68` | hollow dot, "Waiting for invite" |

"last seen" format: under 60 min "last seen N min ago" (1 min minimum); under 24 h "last seen N h ago"; else "last seen 5 Oct". Text updates every 15 s without animation. If my agent shows "last seen" for more than 2 minutes, add under its row `caption` `#4A524E`: "If your agent stopped, tell it: keep listening in the Snapwork room." with a copy button for that sentence.

**Invite** (card title "Invite someone")

- Body `small` `#4A524E`: "This link works once. Send it to the person you want in the room."
- Code block (bg `#F1F3F2`, 1 px `#E2E5E3`, radius 8, padding 12, `code`, `overflow-wrap: anywhere`) showing the invite URL, then primary "Copy link" full width (copy button behaviour 2.5, primary colours).
- Invite URL not available on this device (page reloaded on a device that did not create the room, and nothing stored): body "The invite link was shown when you created the room and can't be shown again here." No button. (See open decision 2.)
- Disappears when a `seat` event shows H2 claimed (instant removal, then toast "{name} joined.").

**Connect your agent** (card title "Connect your agent", collapsible)

- Default expanded when my agent is not online; collapsed when my agent is online, header subline "Connected as {agent_name}" with online dot.
- Tabs (2.6). Each tab panel:
  - "Claude Code": Step label `label` 600 "1. Run once in your terminal". Code block `claude mcp add --transport http snapwork {API_URL}/mcp/{agent_token}` + secondary "Copy command".
  - "Claude Desktop and ChatGPT": "1. Add a custom connector" + `small` `#4A524E` "In settings, add a custom connector or MCP server with this URL." Code block `{API_URL}/mcp/{agent_token}` + "Copy URL".
  - "Other MCP": "1. Add an MCP server" + "Use Streamable HTTP with this URL." Code block URL + "Copy URL".
  - All tabs, then: "2. Paste this into your agent" + prompt code block (max height 200, internal scroll) + primary "Copy prompt" full width.
- Prompt available (in memory, right after create, claim or regenerate): above step 1, a note box bg `#FEF3E2`, 1 px `#F3D19E`, radius 8, padding 12, `small` `#8A4B05`: "Shown once. This contains your agent's secret token. Copy it now; after you leave this page it can't be shown again."
- Prompt not available (any later visit): `small` `#4A524E`: "Your connect prompt was shown once and can't be shown again. If your agent isn't connected, regenerate it." Then secondary "Regenerate connect prompt" (full width on mobile). Tabs hidden in this state.
- Always at the bottom of the card when a prompt is shown: ghost "Regenerate connect prompt".
- Regenerate flow: confirm dialog (2.13) → on success the card shows the new prompt in the "Prompt available" state, tabs visible, focus moves to the card heading, toast "New connect prompt ready. The old one no longer works."
- The agent token and prompt live only in React state; never in `localStorage`, never in logs.

**How approvals work** (card, not collapsible, `small` `#4A524E`, title `label` 600 `#111816` "How approvals work")

"Before doing work beyond chatting, an agent is asked to post an approval request here and wait for its owner. This is a convention, not a lock: Snapwork can't stop an agent on your own computer from acting without approval. Only you can approve your agent's requests."

#### Connection states (SSE)

| State | Trigger | UI |
| --- | --- | --- |
| Connecting | first connect | nothing beyond the loading rule |
| Live | stream open | nothing; no "Live" badge (quiet is the goal) |
| Reconnecting | stream error, retrying | after 2000 ms of continuous disconnect, a strip overlays the top of the timeline (absolutely positioned under the header so nothing reflows): height 36, bg `#FEF3E2`, bottom border 1 px `#F3D19E`, `caption` `#8A4B05`, refresh icon (static) + "Reconnecting…". Header subline (mobile): same text. Opacity in 150 ms. |
| Offline | `navigator.onLine === false`, or reconnecting for more than 30 s | same strip, text "You're offline. Messages will load when you're back." plus ghost text button "Retry now" (44 tall). |
| Back to live | stream open again | strip fades out 150 ms; missed messages (replayed via `Last-Event-ID`) insert without entrance animation; if not at bottom, the jump button shows the count. |

During reconnecting/offline the composer stays fully usable; sends that fail become "Not sent" (3.6). Disconnects shorter than 2000 ms show nothing.

Reconnect timing (implementation hint): retry after 1 s, 2 s, 4 s, then every 8 s; reset on success; also retry immediately on the `online` event and when the tab becomes visible.

### 5.3 `/i/:invite_token` Claim

Layout identical to Create (bg `#F6F7F6`, card on desktop, gutter 16 on mobile).

- Loading preview (> 300 ms): static skeleton for title and subtitle, fields shown disabled.
- Loaded: `small` `#4A524E` "{inviter} invited you to". Title `display`: "{room name}" (wraps, max 3 lines then ellipsis).
- Fields: "Your name" (required, placeholder "Your first name"), "Your agent's name (optional)" placeholder "{name}'s agent" live as in Create.
- Primary "Join room", full width. Loading "Joining…".
- Footer: "No account. Free. Rooms expire after 30 days."
- Errors: validation "Enter your name."; 429 "Too many attempts from this network. Try again in an hour."; network "Couldn't reach Snapwork. Check your connection and try again." (form error box as in Create). `410` on preview or on claim → 410 page with the matching text (used vs room gone, from the error code/message). `404` → 404 page.
- Success: same token handling as Create; navigate to `/r/{room_id}#{owner_token}` with the panel open on the Connect card.

### 5.4 Error pages

Shared layout: bg `#F6F7F6`, centred column max 440, gutter 16, top padding 96 (desktop) / 64 (mobile). Wordmark "Snapwork" `title` at top, 32 px gap, title `display`, 8 px gap, body `body` `#4A524E`, 24 px gap, primary button "Create a new room" → `/` (full width on mobile, auto on desktop). `document.title` is "{title} · Snapwork".

| Case | Title | Body |
| --- | --- | --- |
| 410 invite used | "This invite was already used." | "Invites work once. If you joined earlier, open the room link you bookmarked. Otherwise ask the person who invited you." |
| 410 room gone | "This room is gone." | "Rooms are deleted 30 days after they are created." |
| 404 | "Page not found." | "Check the link and try again." |
| 401 room | "You don't have access to this seat." | "Open the room link you bookmarked when you created or joined the room. A lost link can't be recovered." |

---

## 6. Motion

Principle: motion confirms that something new arrived or something opened. Existing content never moves on its own.

### 6.1 Curves

- `ease-out`: `cubic-bezier(0.2, 0, 0, 1)` for things appearing.
- `ease-in`: `cubic-bezier(0.4, 0, 1, 1)` for things leaving.
- `ease-sheet`: `cubic-bezier(0.32, 0.72, 0, 1)` for sheet and overlay panel.

### 6.2 What animates

| Element | Property | Duration | Curve |
| --- | --- | --- | --- |
| New incoming message (live SSE, 1 to 3 at once) | opacity 0→1, translateY 8 px→0 | 180 ms | ease-out |
| Own optimistic message | opacity 0→1, translateY 8 px→0 | 160 ms | ease-out |
| Approval card arriving | same as incoming message | 180 ms | ease-out |
| Status pill change | background, border, text colour | 150 ms | linear |
| Plan expand/collapse | grid-template-rows, chevron rotate | 200 ms | ease-out |
| Bottom sheet | translateY 100%→0 / back | 280 ms in, 200 ms out | ease-sheet / ease-in |
| Tablet overlay panel | translateX 100%→0 / back | 240 ms in, 180 ms out | ease-sheet / ease-in |
| Scrim | opacity | 200 ms | linear |
| Dialog | opacity, scale 0.98→1 | 160 ms in, 120 ms out (opacity only) | ease-out / linear |
| Toast | opacity, translateY 8 px→0 | 180 ms in, 150 ms out | ease-out / linear |
| Jump button | opacity, translateY 8 px→0 | 160 ms | ease-out |
| Copy icon swap | opacity crossfade | 120 ms | linear |
| Button hover / press | colour 120 ms; scale 0.98 on press 100 ms | | linear / ease-out |
| Reconnect strip | opacity | 150 ms | linear |
| Jump-to-card highlight | card background `#E8F8F0` held 300 ms, then to its normal colour | 1200 ms | ease-out |

Animate only `opacity` and `transform` (plus colours and the plan's grid rows). Entrance animations run once per message id; keep a `Set` of animated ids so a re-render never replays them.

### 6.3 What must NOT animate

- Initial history load, replay after reconnect, or any batch of more than 3 messages arriving together: render instantly.
- The optimistic → confirmed swap (same key, no remount, no fade).
- Positions of existing messages: no FLIP, no layout animations, no smooth scroll on incoming messages.
- Textarea growth, composer height, card height changes after a decision.
- "last seen" text, presence dots (no pulse), skeletons (no shimmer), timestamps.
- Tab indicator (no sliding bar).
- Desktop side panel (it is part of the layout).
- Anything while the user is typing: no focus stealing, no re-render of the composer from SSE (keep composer state local and memoised so SSE updates don't re-render it).

### 6.4 Reduced motion

Under `@media (prefers-reduced-motion: reduce)`:

- All `transform` animations removed (no translate, no scale, no rotate except the chevron, which snaps).
- Messages, toasts, jump button, dialog: appear instantly (no fade).
- Sheet and overlay panel: opacity 0→1 in 120 ms, no slide.
- Plan expand: instant.
- Smooth scrolling becomes `auto`.
- Jump-to-card highlight: no fade; show a 2 px `#18794E` outline on the card for 2000 ms, then remove.
- Spinners: static ring, no rotation; the loading label carries the meaning.

---

## 7. Accessibility

- Landmarks: `<header>`, `<main>` (timeline + composer), `<aside aria-label="Room details">` (panel). Skip link as the first focusable element: "Skip to message box" → textarea (visible on focus, top-left, primary style).
- Focus order on the room page: skip link → header (People button) → banner (Copy link, Dismiss) → timeline links and card buttons in DOM order → composer (To picker, textarea, Send) → panel (desktop; DOM order places the aside after `<main>`).
- Timeline container: `role="log"`, `aria-label="Messages"`, with `aria-live="off"` so the whole log is not read on every change. A separate visually hidden `aria-live="polite"` region announces incoming items only (not history, not replay, not my own sends): "{name}: {first 140 characters}" for chat; "{agent} asks {owner} for approval: {task}" for approval requests (prefix "Needs your decision. " when addressed to me); "{owner} approved/declined {agent}'s request." for decisions. Throttle to at most one announcement per 1000 ms; when several arrive in that window announce "{n} new messages."
- Every message row is an `<article>` with `aria-label` "{name}, {agent if agent}, {time}" so screen reader users can jump between messages; it is not focusable itself.
- Labels: every input has a visible `<label>`; textarea `aria-label="Message"`; To picker `aria-label="Send to"`; icon buttons have `aria-label` ("Send", "Close", "Dismiss", "People"). Status pills are text. Presence is text.
- Form errors: `aria-invalid`, `aria-describedby`, focus first invalid field on submit; form-level error box has `role="alert"`.
- Composer keyboard: Enter sends, Shift+Enter newline, Ctrl/Cmd+Enter sends, IME guard (5.2). Focus stays in the textarea after sending. Esc in the textarea does nothing.
- Approval buttons: "Approve" / "Decline" with `aria-describedby` pointing to the task text so the action is announced with context.
- Dialog and overlays: focus trap, Esc closes, focus returns to the trigger.
- Touch targets: 44 × 44 minimum for every interactive element including text buttons inside the timeline ("Retry", "View request", "See result", "Done · task" link: give them `padding-block` so the hit area reaches 44 px without changing visual size, or a `::before` hit-area extension).
- Zoom: layout works at 200 % zoom and at 320 px width without horizontal scroll.
- Language: `<html lang="en">`; each message bubble gets `lang="vi"` when `room.lang === 'vi'` and the message is a system/greeting message from the server (user text has no reliable language, leave it unset).

---

## 8. Do not

- No gradients: not on buttons, backgrounds, avatars, borders, banners, skeletons or anywhere else.
- No emoji, anywhere in the UI or in system copy.
- No second accent colour. Status colours (warning, danger) are only for state, never decoration. No per-person avatar colours.
- No white text on `#3ECF8E`. No `#3ECF8E` or `#1F8A5B` as text on light backgrounds; use `#18794E`.
- No markdown rendering, no `dangerouslySetInnerHTML`, no HTML in bodies. Only `<a>` for `https?://` URLs.
- No dark mode, no theme toggle.
- No shadows on inline content (bubbles, cards in the timeline, panel cards). Shadows only on floating layers.
- No animation on existing messages, no shimmer, no pulsing dots, no typing indicators (there is no typing signal in the API).
- No claim that approvals are enforced.
- No disabling the textarea while sending.
- No icon library, no component kit, no animation library.
- No storing the agent token or the connect prompt in `localStorage`.

---

## 9. Implementation note for the coder: Tailwind v4 theme

Replace `apps/web/src/index.css` contents with the block below (then add your own component CSS under it). `--color-*: initial` removes Tailwind's default palette so only these colours exist; `bg-transparent` and `text-current` still work.

```css
@import "tailwindcss";

@theme {
  --color-*: initial;

  --color-canvas: #F6F7F6;
  --color-surface: #FFFFFF;
  --color-sunken: #F1F3F2;
  --color-avatar: #E9ECEA;
  --color-line: #E2E5E3;
  --color-line-strong: #C9CECB;
  --color-control: #7F8984;

  --color-ink: #111816;
  --color-ink-2: #4A524E;
  --color-ink-3: #646C68;

  --color-accent: #3ECF8E;
  --color-accent-hover: #34BE80;
  --color-accent-active: #2DB574;
  --color-on-accent: #0B2A1C;
  --color-accent-ink: #18794E;
  --color-accent-ink-hover: #11603D;
  --color-accent-soft: #E8F8F0;
  --color-accent-soft-line: #B7EBD2;

  --color-danger: #C2362B;
  --color-danger-hover: #A82D23;
  --color-danger-soft: #FDECEA;
  --color-danger-soft-line: #F5C2BD;

  --color-warning-ink: #8A4B05;
  --color-warning-soft: #FEF3E2;
  --color-warning-soft-line: #F3D19E;

  --color-online: #249361;
  --color-offline: #7F8984;
  --color-toast: #111816;
  --color-white: #FFFFFF;

  --font-sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;

  --text-display: 1.5rem;        --text-display--line-height: 2rem;
  --text-display-lg: 1.75rem;    --text-display-lg--line-height: 2.25rem;
  --text-title: 1.125rem;        --text-title--line-height: 1.625rem;
  --text-header: 1rem;           --text-header--line-height: 1.5rem;
  --text-body: 1rem;             --text-body--line-height: 1.5rem;
  --text-body-lg: 0.9375rem;     --text-body-lg--line-height: 1.375rem;
  --text-label: 0.875rem;        --text-label--line-height: 1.25rem;
  --text-small: 0.875rem;        --text-small--line-height: 1.25rem;
  --text-caption: 0.8125rem;     --text-caption--line-height: 1.125rem;
  --text-micro: 0.75rem;         --text-micro--line-height: 1rem;
  --text-code: 0.8125rem;        --text-code--line-height: 1.25rem;

  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --shadow-overlay: 0 8px 24px rgba(17, 24, 22, 0.12), 0 1px 2px rgba(17, 24, 22, 0.08);

  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);

  --animate-enter: enter 180ms var(--ease-out) both;
  --animate-enter-own: enter 160ms var(--ease-out) both;

  @keyframes enter {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}

@layer base {
  html { background: var(--color-surface); color: var(--color-ink); font-family: var(--font-sans); -webkit-text-size-adjust: 100%; }
  body { margin: 0; -webkit-font-smoothing: antialiased; }
  button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  :focus-visible { outline: 2px solid var(--color-accent-ink); outline-offset: 2px; }
  :focus:not(:focus-visible) { outline: none; }
  ::selection { background: var(--color-accent-soft); color: var(--color-ink); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

Usage notes:

- Message body: `text-body lg:text-body-lg`. Inputs: `text-body lg:text-body-lg` (keeps 16 px under 1024 px). Page titles: `text-display lg:text-display-lg`.
- `body-lg` is the desktop body size (15/22); the name refers to the breakpoint, not the size.
- Primary button: `bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-active`. Text green: `text-accent-ink`.
- Entrance: add `animate-enter` only to rows whose id is new and live (6.2); the reduced-motion block neutralises it.
- The reduced-motion block uses 1 ms (not 0) so `animationend` / `transitionend` handlers still fire.

---

## 10. Decisions (approved by the product owner)

The design was reviewed and approved. The three open points were settled by taking the recommended option:

1. Enter on phones: on `pointer: coarse` devices Enter inserts a newline and only the Send button sends. On desktop Enter sends and Shift+Enter inserts a newline, as in `PROJECT.md`.
2. Invite link after reload: keep `invite_url` in `localStorage` (`snapwork:invite:{room_id}`) next to the owner token until the second person has claimed, then delete it. If it is missing, show the "can't be shown again" state in 5.2.
3. Text green is `#18794E` (5.41:1). The fill stays `#3ECF8E`.

A visual version of this document is in `docs/design-review.html` (open it in a browser).
