# Site design: Snapwork public website (`apps/site`)

Owner: designer subagent. Audience: the developer who builds `apps/site`, and the reviewer who checks it. This file is the spec for the public marketing page only. The product's design system is `docs/design-direction.md` ("DD" below). This page reuses its tokens by name and value; it adds no colour. If this file and DD disagree on a shared component, DD wins. If this file and `PROJECT.md` / `README.md` disagree on what the product does, those win and the copy here must be fixed.

The page has one job: a visitor who already uses an AI agent understands the product in 30 seconds and presses **Create a room**.

Fixed constraints: light theme only; one accent (fill `accent` `#3ECF8E`, text green `accent-ink` `#18794E`); no gradients anywhere; no emoji; IBM Plex Sans and IBM Plex Mono from Google Fonts with the `vietnamese` subset; 44 px minimum touch targets; works at 390 px with no horizontal scroll; plain HTML and CSS. **This spec uses no JavaScript at all** (section 9 explains why that matters for the CSP).

---

## 0. Files, placeholders, hosting

```
apps/site/
  index.html        the page
  site.css          the only stylesheet (no framework, no preprocessor)
  favicon.svg       section 8.3
  apple-touch-icon.png   180 x 180, section 8.3
  og.png            1200 x 630, section 8.4 (fetched by link previews only, not by the page)
  404.html          section 8.6
  robots.txt        section 8.6
  netlify.toml      section 9
```

No `package.json` in `apps/site` (pnpm ignores a workspace folder without one). No build tool.

Placeholders, kept literally in source and replaced at deploy:

| Placeholder | Meaning | Example |
| --- | --- | --- |
| `%APP_URL%` | Origin of the web app, no trailing slash. The create-room screen is `%APP_URL%/`. | `https://app.example.com` |
| `%SITE_URL%` | Origin of this site, no trailing slash. Used in canonical and Open Graph tags, which must be absolute. | `https://example.com` |

Replace them in the Netlify build command (section 9). Definition of done includes "no `%` placeholder left in the deployed HTML".

Hosting: a **second** Netlify site, separate from the app. In the Netlify UI set Base directory `apps/site`; Netlify then reads `apps/site/netlify.toml`. The repo-root `netlify.toml` belongs to the app and must not be changed for this.

---

## 1. Foundations

### 1.1 Colour (reused from DD 1.1 and DD 9, same names, same values)

Only these tokens appear on the site. Use them as CSS custom properties with DD 9's names so the two codebases read the same.

```css
:root {
  color-scheme: light;
  --color-canvas: #F6F7F6;
  --color-surface: #FFFFFF;
  --color-sunken: #F1F3F2;
  --color-avatar: #E9ECEA;
  --color-line: #E2E5E3;
  --color-line-strong: #C9CECB;
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
  --color-warning-ink: #8A4B05;
  --color-warning-soft: #FEF3E2;
  --color-warning-soft-line: #F3D19E;
}
```

Not used on the site: `control`, `danger*`, `online`, `offline`, `toast`, `white`. Do not add them "just in case".

Where colour goes:

| Token | Site use |
| --- | --- |
| `canvas` | Page background; header; hero, approvals, limits sections; footer |
| `surface` | How it works, agents and FAQ sections; mock chat frames; the honesty note; secondary buttons |
| `sunken` | Code snippets, inline code, "agent" tag fill, other-human bubble in the mocks, hover fill on nav link and FAQ rows, plan body in the mock |
| `avatar` | Human avatar fill in the mocks; secondary button pressed |
| `line` | Section dividers, frame header divider, agent bubble border, FAQ row dividers, snippet border |
| `line-strong` | Mock frame border, approval card border, step and limit top rules, secondary button border |
| `ink` | Headings, primary text, FAQ questions |
| `ink-2` | Leads, body paragraphs, nav link, chevrons |
| `ink-3` | Captions, figure captions, small labels, timestamps in the mocks |
| `accent` | Primary button fill, the pending card's 2 px border and the "Done" pill in the mocks, the mark (favicon and wordmark) |
| `on-accent` | Text on any `accent` fill; the two bars in the mark |
| `accent-ink` | Text links, "Step 1" labels, list markers, the focus ring, "to Wren"-style highlights in the mocks |
| `accent-ink-hover` | Link hover |
| `accent-soft` / `accent-soft-line` | Final call-to-action band and its top border |
| `warning-*` | Only the "Pending" pill inside the hero mock |

### 1.2 Contrast (computed by script, WCAG 2.x relative luminance)

The script is the same formula as DD 1.2. Every text pair used on the site:

| Foreground | Background | Ratio | AA (4.5) | Where on the site |
| --- | --- | --- | --- | --- |
| ink `#111816` | surface `#FFFFFF` | 18.01 | pass | headings and text in surface sections, mock bubbles |
| ink `#111816` | canvas `#F6F7F6` | 16.77 | pass | hero heading, header wordmark, limits headings |
| ink `#111816` | sunken `#F1F3F2` | 16.16 | pass | code snippets, other-human bubble, plan body |
| ink `#111816` | accent-soft `#E8F8F0` | 16.39 | pass | final CTA heading |
| ink-2 `#4A524E` | surface `#FFFFFF` | 8.05 | pass | body text in surface sections, FAQ answers |
| ink-2 `#4A524E` | canvas `#F6F7F6` | 7.50 | pass | hero lead, nav link, limits text |
| ink-2 `#4A524E` | sunken `#F1F3F2` | 7.22 | pass | "agent" tag, nav link on hover fill |
| ink-2 `#4A524E` | accent-soft `#E8F8F0` | 7.33 | pass | final CTA text and note |
| ink-2 `#4A524E` | avatar `#E9ECEA` | 6.77 | pass | human avatar initial |
| ink-3 `#646C68` | surface `#FFFFFF` | 5.40 | pass | snippet hints, mock timestamps and sublines, row labels |
| ink-3 `#646C68` | canvas `#F6F7F6` | 5.03 | pass | figure captions, hero note, footer small print |
| ink-3 `#646C68` | sunken `#F1F3F2` | 4.85 | pass | (allowed, avoid if possible) |
| accent-ink `#18794E` | surface `#FFFFFF` | 5.41 | pass | links, "Step N" labels, list markers, "to you" in mocks |
| accent-ink `#18794E` | canvas `#F6F7F6` | 5.03 | pass | links in canvas sections, footer links on hover |
| accent-ink `#18794E` | accent-soft `#E8F8F0` | 4.92 | pass | (link in the CTA band, if any) |
| accent-ink-hover `#11603D` | surface `#FFFFFF` | 7.60 | pass | link hover |
| accent-ink-hover `#11603D` | canvas `#F6F7F6` | 7.07 | pass | link hover |
| on-accent `#0B2A1C` | accent `#3ECF8E` | 7.72 | pass | primary button, "Done" pill |
| on-accent `#0B2A1C` | accent-hover `#34BE80` | 6.48 | pass | primary hover |
| on-accent `#0B2A1C` | accent-active `#2DB574` | 5.85 | pass | primary pressed |
| warning-ink `#8A4B05` | warning-soft `#FEF3E2` | 6.19 | pass | "Pending" pill in the hero mock |
| white `#FFFFFF` | accent `#3ECF8E` | 2.00 | FAIL | never |
| accent `#3ECF8E` | surface `#FFFFFF` | 2.00 | FAIL | never as text |
| ink-3 `#646C68` | line `#E2E5E3` | 4.26 | FAIL | never |

Non-text (WCAG 1.4.11, 3:1):

| Element | Colour | Against | Ratio |
| --- | --- | --- | --- |
| Focus ring | accent-ink `#18794E` | surface | 5.41 |
| Focus ring | accent-ink `#18794E` | canvas | 5.03 |
| Focus ring | accent-ink `#18794E` | sunken | 4.85 |
| Focus ring | accent-ink `#18794E` | accent-soft | 4.92 |
| Chevron icons | ink-2 `#4A524E` | surface | 8.05 |
| Primary button fill | accent `#3ECF8E` | canvas | 1.86 (exempt: the label identifies the control, as in DD 1.2) |
| Secondary button border | line-strong `#C9CECB` | canvas | 1.48 (exempt for the same reason; same as the app) |

### 1.3 Typography

Families and weights exactly as DD 1.3: Sans 400, 500, 600; Mono 400, 500. No italic, no 700. Letter spacing 0 everywhere. No all-caps. Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty` (both ignored safely where unsupported).

Font request (same URL as the app, so the browser cache is shared if both are visited):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap&subset=latin,latin-ext,vietnamese">
```

Measured on 2026-10-07: Google now serves IBM Plex Sans as one variable file per subset (all three weights in one download). Latin: Sans 45.7 KB, Mono 400 14.7 KB, Mono 500 14.9 KB. The Vietnamese Sans block is 13.2 KB and downloads only because the FAQ shows one Vietnamese sentence (that is intended; it proves the subset works). `subset=` is ignored by the css2 API and kept to document intent, as in DD.

Font stacks (the site adds a metric-matched fallback face before the system fonts, so the swap does not shift layout):

- Sans: `"IBM Plex Sans", "Plex Sans Fallback", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`
- Mono: `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace` (no fallback face needed: Plex Mono and Courier-class fonts have the same 0.6 em advance, measured 99.98 %)

Fallback faces (values measured with fontTools against Liberation Sans, which is metric-identical to Arial; Plex Sans has unitsPerEm 1000, ascender 1025, descender 275, line gap 0; widths compared on an English sample of this page's copy):

```css
@font-face {
  font-family: "Plex Sans Fallback";
  src: local("Arial"), local("ArialMT"), local("Liberation Sans");
  font-weight: 100 550;
  size-adjust: 100.05%;
  ascent-override: 102.45%;
  descent-override: 27.49%;
  line-gap-override: 0%;
}
@font-face {
  font-family: "Plex Sans Fallback";
  src: local("Arial Bold"), local("Arial-BoldMT"), local("Liberation Sans Bold");
  font-weight: 551 900;
  size-adjust: 96.56%;
  ascent-override: 106.15%;
  descent-override: 28.48%;
  line-gap-override: 0%;
}
```

Weight 600 text maps to the bold face (no synthetic bold); 400 and 500 map to the regular face. On Android (no Arial) the face does not load and the stack falls through to `system-ui`; that small shift is accepted.

Site type scale. Breakpoints are DD's: mobile `< 768` (designed at 390), tablet `768–1023`, desktop `≥ 1024` (designed at 1280). Size / line height / weight.

| Token | < 768 | 768–1023 | ≥ 1024 | Use |
| --- | --- | --- | --- | --- |
| `site-display` | 34 / 40 / 600 | 44 / 52 / 600 | 52 / 60 / 600 | The one `h1` |
| `site-h2` | 26 / 32 / 600 | 32 / 40 / 600 | 36 / 44 / 600 | Section headings |
| `site-h3` | 18 / 26 / 600 | 18 / 26 / 600 | 20 / 28 / 600 | Step titles, agent names, limit titles |
| `site-lead` | 18 / 28 / 400 | 20 / 30 / 400 | 20 / 30 / 400 | Hero subhead, section leads |
| `site-body` | 16 / 26 / 400 | 16 / 26 / 400 | 17 / 28 / 400 | Paragraphs, FAQ answers |
| `site-faq-q` | 16 / 24 / 500 | 18 / 26 / 500 | 18 / 26 / 500 | FAQ questions (`summary`) |
| DD `label` | 14 / 20 / 500 | same | same | Nav link, row labels, button text (600) |
| DD `small` | 14 / 20 / 400 | same | same | Footnotes |
| DD `caption` | 13 / 18 / 400 | same | same | Figure captions, hero note, footer small print, snippet hints |
| DD `code` | 13 / 20 / 400 mono | same | same | Snippets |
| Step label | 13 / 20 / 500 mono | same | same | "Step 1" |

Inside the two chat mocks, use DD's app tokens exactly (DD 1.3: `body` 16/24 under 1024 and 15/22 at 1024 and up, `label`, `caption`, `micro`), so the mock is the real product at real size.

Measured wrapping (Plex Sans 600 advances): the `h1` "Put your agent and theirs in one chat." is 588 px wide at 34 px, so at 390 (358 px column) it breaks as "Put your agent and / theirs in one chat."; at 52 px in the 536 px desktop column it breaks the same way. At 44 px in the 688 px tablet column it would leave "chat." alone; `text-wrap: balance` fixes that. Same for "Agents ask before they work" (36 px in 496 px) and "Start a room and send one link." (26 px in 358 px).

Inline code inside paragraphs: Mono 400 at `0.875em`, bg `sunken`, padding 1 px 4 px, radius 4, colour `ink`, `overflow-wrap: anywhere`.

### 1.4 Spacing, container, rhythm

Spacing values: DD's scale (2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64) plus two section values only the site uses, 80 and 96.

- Container: `width: min(1120px, 100% - 2 * gutter); margin-inline: auto`. Gutter 16 below 768, 24 from 768.
- Prose measure: paragraphs and leads `max-width: 640px` (about 70 characters at 16 px).
- Section padding-block: 64 (< 768), 80 (768–1023), 96 (≥ 1024). Every section is a full-bleed band; bands alternate `canvas` and `surface`, separated by a 1 px `line` top border on each section after the hero.
- Section head: `h2`, then lead 12 px below (16 at ≥ 1024). Head to content: 32 (< 768), 40 (768–1023), 48 (≥ 1024).
- Paragraph to paragraph: 16. Heading `h3` to its text: 8.
- `html { scroll-padding-top: 16px; }` so anchor targets do not touch the top edge.

Radii, borders, shadows: DD 1.4 unchanged. Radius 8 for buttons, snippets and inline-code-sized things (4 for inline code and the "agent" tag), 12 for the approval card and the honesty note, 16 (`radius-lg`) for the mock frames. Borders always 1 px except the focus ring and the pending card (2 px). **No shadows anywhere on the site** (there are no floating layers).

### 1.5 Icons

Same rules as DD 1.6: inline SVG, 24 × 24 viewBox, `stroke="currentColor"`, stroke width 1.75, round caps and joins, no fill, `aria-hidden="true"`, `focusable="false"`. The site needs two:

- chevron-down: `<path d="M6 9l6 6 6-6"/>` (FAQ rows, plan toggle in the mock)
- check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>` (result row in the second mock, 14 px)

No icons as decoration next to headings or steps.

---

## 2. Page structure

Order, with the job of each section:

| # | Section | id | Band | Job |
| --- | --- | --- | --- | --- |
| 0 | Skip link + header | — | canvas | Name the product, one way to the FAQ, one way to the app |
| 1 | Hero | `top` | canvas | Say what it is in one line, show the real room with an agent asking its owner, offer the button |
| 2 | How it works | `how` | surface | Three steps, each with the real thing you get (a link, an invite link, an install line) |
| 3 | Agents ask before they work | `approvals` | canvas | The key idea, shown as the same request from the hero now resolved, plus the honest "convention, not a lock" note |
| 4 | Works with | `agents` | surface | Which agents, how each connects, and the caveats (ChatGPT plan limits) |
| 5 | What Snapwork is not | `limits` | canvas | The limits, stated plainly before anyone invites a client |
| 6 | Questions | `faq` | surface | Native `<details>` FAQ |
| 7 | Final call to action | — | accent-soft | One more button after the reader has seen the limits |
| 8 | Footer | — | canvas | Links, privacy line, trademark line |

Why this order and not the generic one: the hero already shows a chat with an approval card, so the first thing a visitor sees is the product, not a promise. Section 3 continues the same story (the hero's pending request, later approved and done) rather than restating features. Limits come before the FAQ and before the last button on purpose: people who press the last button have read what the product does not do. There is no feature grid, no testimonial strip, no logo row and no "how we compare" table.

Wireframe at 390:

```
┌ header 64 ────────────────────────────┐
│ [■] Snapwork        FAQ [Create a room]│
├ hero ─────────────────────────────────┤
│ Put your agent and                    │
│ theirs in one chat.                   │
│ lead (4 lines)                        │
│ [ Create a room                     ] │
│ [ See how it works                  ] │
│ No account. Free. Rooms expire …      │
│ ┌ mock frame ───────────────────────┐ │
│ │ Café website proposal  2 people…  │ │
│ │ Otto greeting                     │ │
│ │ David → Wren                      │ │
│ │ ┌ approval card, Pending ───────┐ │ │
│ │ │ … [Approve] [Decline]         │ │ │
│ └───────────────────────────────────┘ │
│ caption                               │
├ how (surface) ── step 1, 2, 3 stacked ┤
├ approvals (canvas) ── text, note, mock┤
├ agents (surface) ── 4 stacked rows ───┤
├ limits (canvas) ── 6 stacked items ───┤
├ faq (surface) ── 14 details rows ─────┤
├ CTA band (accent-soft) ───────────────┤
└ footer (canvas) ──────────────────────┘
```

Wireframe at 1280 (container 1120, side margins 80):

```
┌ header 64 ───────────────────────────────────────────────────────────┐
│ [■] Snapwork                                     FAQ  [Create a room] │
├ hero: text column (536) ──────────── 64 gap ──── mock frame (520) ────┤
│ Put your agent and                              ┌──────────────────┐ │
│ theirs in one chat.                             │ frame            │ │
│ lead                                            │ greeting         │ │
│ [Create a room] [See how it works]              │ David → Wren     │ │
│ No account. Free. Rooms expire …                │ Otto notes       │ │
│                                                 │ approval card    │ │
│                                                 └──────────────────┘ │
├ how: h2 + lead, then 3 columns (352 each, gap 32) ────────────────────┤
├ approvals: text column (496) ─────── 64 gap ──── mock frame (560) ────┤
├ agents: rows, grid 240 | 1fr | 1fr ───────────────────────────────────┤
├ limits: 2 columns of 3 items ─────────────────────────────────────────┤
├ faq: head column (320) ──── 64 gap ──── details list (max 720) ───────┤
├ CTA band: text left, button right ────────────────────────────────────┤
└ footer: wordmark + links row, then small print ───────────────────────┘
```

---

## 3. Sections: copy, layout and details

All copy below is final. Paste it as written. Straight apostrophes in source are fine; do not add curly quotes by hand in some places and not others. Inline code is shown in backticks and becomes `<code>`.

### 3.0 Skip link and header

Skip link (first element in `<body>`): **Skip to content** → `#main`.

Header copy:

- Wordmark link: mark + **Snapwork**, `href="/"`. Accessible name "Snapwork" (the mark is `aria-hidden`).
- Nav link: **FAQ** → `#faq`.
- Button link: **Create a room** → `%APP_URL%/`.

Layout (both sizes): `<header>` height 64, bg `canvas`, bottom border 1 px `line`, container as 1.4. One row, `display: flex; align-items: center; justify-content: space-between`. Right group: `<nav aria-label="Main">` holding the FAQ link, then the button, 8 px gap. Not sticky (the hero button, step section and the final band all repeat the action; a sticky bar would cover anchor targets and cost a scroll listener).

Wordmark: mark 24 × 24 (the favicon SVG inline, section 8.3), 8 px gap, "Snapwork" Plex Sans 18 / 26 / 600 `ink`. Link box min-height 44, padding 0 4, margin-inline -4, radius 8. Hover: no change. Focus: global ring.

At 390 everything fits in one row, measured: wordmark 24 + 8 + 85 = 117 px, FAQ link 51 px, button 123 px, 8 px gap between FAQ and the button → 299 of 358 px. No menu button, no hamburger, no JS. At 320 px (200 % zoom) the row would overflow: below 360 px hide the FAQ link (`@media (max-width: 359px)`), the FAQ is still reachable by scrolling and from the footer.

### 3.1 Hero

Copy:

- `h1`: **Put your agent and theirs in one chat.**
- Lead (`p`): **Snapwork is a group chat for two people and their AI agents, on different accounts and machines. No sign-up. Before an agent does real work, it asks its owner in the chat.**
- Primary button (large): **Create a room** → `%APP_URL%/`
- Secondary button (large): **See how it works** → `#how`
- Note under the buttons: **No account. Free. Rooms expire after 30 days.** (identical to the app's create-page footer)
- Figure caption: **An example room. Wren is Lan's agent and Otto is David's. Wren asks Lan before it starts the draft. The Approve and Decline buttons appear only for Lan.**

Layout < 768: single column. Section padding: top 40, bottom 64. `h1` (`site-display`, `ink`), 16 px, lead (`site-lead`, `ink-2`, 4 lines at 390), 32 px, buttons stacked full width with 12 px gap (primary first), 16 px, note (`caption`, `ink-3`), 40 px, figure (frame full container width, 358 px at 390), 12 px, caption.

Layout 768–1023: single column, top padding 56, bottom 80. Text max-width 640. Buttons in a row, auto width, 12 px gap, `flex-wrap: wrap`. Frame `max-width: 560px`, left aligned, 48 px above it.

Layout ≥ 1024: two columns, `grid-template-columns: minmax(0, 1fr) 520px; column-gap: 64px; align-items: start`. Top padding 64, bottom 96. At 1280 the text column is 536 px. Text column gets `padding-top: 24px` so the `h1` sits a little below the frame's top edge. `h1` to lead 20 px. Buttons in a row. Frame in the right column at 520 px; the caption under it, 12 px gap.

Why left-aligned text and a real UI on the right, and not a centred hero: the product is a chat; showing the chat with an approval card in it explains more than any slogan, and left-aligned text reads faster.

Above-the-fold check at 390 × 844: header 64 + top 40 + `h1` 80 + 16 + lead 112 + 32 + buttons 116 + 16 + note 18 = 494 px, so both buttons and the top of the frame are visible without scrolling. At 1280 × 800 the Approve and Decline buttons in the mock start at about y = 745 and end at about y = 790, so they are visible without scrolling (estimate from the 3.1.1 content; verify in the browser and, if they fall below, reduce the hero top padding to 48).

#### 3.1.1 The hero visual: a static composition of the real room

Built with HTML and CSS from the same components as DD: frame (new, below), agent bubble (DD 3.2), other-human bubble (DD 3.2), "agent" tag (DD 2.8), avatars (DD 2.10), approval card in "pending, mine" state (DD 4.1, 4.2), status pill (DD 2.7), collapsible plan (DD 2.12, implemented here with native `<details>`), primary and secondary buttons (DD 2.1). No images, no screenshot, no canvas.

The viewer is **Lan** (so "asks you" and the green border are correct). People: **Lan** (human, viewer), **Wren** (Lan's agent), **David** (human), **Otto** (David's agent). Room name: **Café website proposal**.

Content, in order (exact strings):

1. **Otto** [agent tag] **10:09**, subline **David's agent**. Bubble (agent style): **Hi everyone, I'm Otto, David's agent.** (This is the server's real greeting template from `PROJECT.md` §8.)
2. **David** **10:11**, subline **to Wren** (`caption`, `ink-3`). Bubble (other-human style, `sunken`): **Can you draft the one-page proposal? Otto has our notes from Tuesday's call.**
3. **Otto** [agent tag] **10:12**, subline **David's agent · to Wren**. Bubble: **Notes from Tuesday: three cafés, new menu pages, launch before 1 March. Budget is not fixed yet.** Hidden below 768 px (`display: none`) to keep the mock short on phones; item 2 still reads correctly without it.
4. **Wren** [agent tag] **10:14**, subline **Your agent**. Approval card, pending, addressed to the viewer:
   - Top row: **Approval request** (`label` 600 `ink-2`) left; pill **Pending** right (warning colours, DD 2.7).
   - Who: **Wren asks you · 10:14** (`caption`, `ink-3`).
   - Task (`body` weight 500 `ink`): **Draft a one-page proposal from Otto's notes.**
   - Plan: `<details>`, closed by default. Summary text **Show plan** when closed, **Hide plan** when open (two spans, CSS shows one based on `details[open]`), chevron 16 px rotating 180°. Body (`sunken`, radius 8, padding 12, `small` `ink`, `white-space: pre-wrap`):
     ```
     1. Read Otto's notes in this room.
     2. Write scope, timeline and open questions.
     3. Post the draft here as a message.
     ```
     Note: in the app the owner's own pending card opens the plan by default (DD 4.1). The mock starts closed to keep it short; this is the only deliberate difference from the product.
   - **Needs your decision** (`caption` 600 `ink`).
   - Two buttons side by side, each `flex: 1`, 8 px gap: primary **Approve**, secondary **Decline**. In the mock they are `<span>` elements with the button classes, `aria-hidden="true"`, `cursor: default`, and no hover or active styles. They are not focusable and do nothing.
   - Caption (`caption`, `ink-3`): **Snapwork can't stop your agent from acting. Approving is how you tell it to go ahead.** (DD 4.2 wording, unchanged.)

No system line, no composer, no own (green) bubble in the hero; they would push the approval card below the fold on desktop. Times are plain text, not `<time>` elements.

Frame (new component, the only one this spec adds):

- `<figure class="mock">`, margin 0. Inner box: bg `surface`, 1 px `line-strong`, radius 16, `overflow: hidden`. No shadow.
- Frame header: height 48, padding 0 16, bottom border 1 px `line`, flex row, space-between. Left: room name **Café website proposal**, `header` token (16 / 24 / 600 `ink`), single line, ellipsis. Right: **2 people, 2 agents** (`caption`, `ink-3`), `white-space: nowrap`. Measured: 173 + 108 px, fits the 326 px inner width at 390.
- Timeline: `<ol>` with `list-style: none`, padding 16, one `<li>` per message, gaps from DD 3.3 (16 between groups, 24 around the approval card).
- Message rows: DD 3.1 and 3.2 exactly. 32 px avatar column, 8 px gap, header line (name `label` 600, tag, time `micro` 400 `ink-3`), subline, bubble (radius 12, top-left corner 4, padding 8 12, `overflow-wrap: anywhere`, `white-space: pre-wrap`). Bubble max width 85 % of the column after the avatar.
- Approval card: DD 4.1 with the 2 px `accent` border and 15 px padding (pending, mine), width 100 % of the column after the avatar.
- Avatars: Otto and Wren are agent squares (initials **O**, **W** in Mono 500); David a human circle (**D**).

Behaviour at 390: frame 358 px wide; content column after avatar = 358 − 2 (border) − 32 (padding) − 40 (avatar + gap) = 284 px; card inner width 250 px; Approve and Decline are 121 px each (labels measured at 55 and 49 px). Item 3 hidden. Estimated frame height about 700 px with the plan closed. Nothing scrolls inside the frame; no fixed heights anywhere, so long words wrap instead of overflowing.

Behaviour at 1280: frame 520 px, all four items shown, desktop `body` size 15 / 22 inside bubbles. Estimated height about 740 px.

Accessibility of the mock: it is real text and stays readable by screen readers (it is the clearest description of the product). Wrap the timeline in `<ol aria-label="Example messages">`. The fake buttons are `aria-hidden` and the visible caption says the buttons appear only for Lan. The plan `<details>` is the only focusable thing inside the mock and it works. Do not put `role="img"` on the figure (that would hide the text).

### 3.2 How it works (`#how`)

Copy:

- `h2`: **How it works**
- Lead: **Three steps. You need an agent that can use MCP tools, and so does the other person.**
- Steps (`<ol>`; each step: label, `h3`, text, snippet, hint):
  1. Label **Step 1**. `h3` **Create a room.** Text: **Name the room and yourself. No account and no email. You land in the room, and that page's link is your key to it.** Snippet: `%APP_URL%/r/r_8f3k2m9q1x#own_…` Hint: **Bookmark it. It is the only way back into your seat.**
  2. Label **Step 2**. `h3` **Invite one person.** Text: **Send them the invite link from the room. They pick a name and get their own room link.** Snippet: `%APP_URL%/i/inv_…` Hint: **The invite link works once.**
  3. Label **Step 3**. `h3` **Connect your agents.** Text: **Each person gives their own agent their own connect prompt. The agent joins over MCP and says hello to the room.** Snippet: `claude mcp add --transport http snapwork <your connection URL>` Hint: **That is the Claude Code line. Other agents use a custom connector. See the list below.** ("See the list below" is a link to `#agents`.)
- After the steps (`p`): **From then on, everyone writes in one timeline, and you can address a message to one person or one agent. If six messages in a row come from agents, the room pauses until a person writes.**

Step anatomy: label (Mono 500 13 / 20 `accent-ink`), 8 px, `h3` (`site-h3` `ink`), 8 px, text (`site-body` `ink-2`), 16 px, snippet, 8 px, hint (`caption` `ink-3`). Each step has `border-top: 1px solid line-strong` and `padding-top: 20px`.

Snippet: `<code>` block inside a `<p>` (or `<pre>` with `white-space: pre-wrap`): bg `sunken`, 1 px `line`, radius 8, padding 12, DD `code` 13 / 20 Mono 400 `ink`, `overflow-wrap: anywhere`. No copy button (nothing here is a real value).

Layout < 1024: steps stacked, 40 px between steps. Snippets full width.
Layout ≥ 1024: `grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 32px`, `align-items: start`; at 1280 each column is 352 px. After-steps paragraph 48 px below, `max-width: 640px`.

These are three steps with different, real artefacts (a room link, an invite link, an install line), not three interchangeable feature cards. No boxes, no icons, no shadows.

### 3.3 Agents ask before they work (`#approvals`)

Copy:

- `h2`: **Agents ask before they work**
- Lead: **Chatting is free. Anything more, like running code, reading files or writing a deliverable, starts with a request to the agent's own owner.**
- Ordered list (`<ol>`, each item an `h3` and a `p`):
  1. `h3` **The agent asks.** `p` **It posts a request card with the task and its plan, then waits.**
  2. `h3` **Only its owner decides.** `p` **Approve and Decline appear only for the agent's owner. Everyone else sees who has to decide. A message that says "approved" is just text and does not count.**
  3. `h3` **It reports back.** `p` **When it is done, the agent posts the result, linked to the request.**
- Honesty note (a bordered box, not a warning):
  - Title (`p` with `strong`, 16 / 24 / 600 `ink`): **This is a convention, not a lock.**
  - Body: **Snapwork can't stop an agent from acting on its owner's machine. The connect prompt tells each agent to wait for a decision, and the room shows every request and decision to everyone. Don't treat it as a security control.**
- Figure caption: **The same request a few minutes later: Lan approved it and Wren posted the result.**

Second mock (same frame component, viewer still Lan, room **Café website proposal**):

1. **Wren** [agent] **10:14**, subline **Your agent**. Approval card, decided state (DD 4.2): border 1 px `line-strong`, padding 16. Top row **Approval request** + pill **Done** (`accent` fill, `on-accent` text). Who **Wren asks you · 10:14**. Task **Draft a one-page proposal from Otto's notes.** Plan `<details>` closed (same as hero). Footer `caption` `ink-2`: **Done · 10:21 · ** followed by **See result** styled as a link (`accent-ink` 600) but rendered as a `<span>` (no `href`; nothing to navigate to).
2. System line (DD 3.5, centred, `caption` `ink-3`): **Lan approved the request from Wren.** followed by **View request** styled as a link (`accent-ink`), also a `<span>`.
3. **Wren** [agent] **10:21**, subline **Your agent**. Agent bubble with the result row first (DD 3.9): check icon 14 px + **Done · Draft a one-page proposal from Otto's notes.** in `caption` 600 `accent-ink`, 8 px gap, then body: **Here is the one-page draft: scope, timeline and two open questions for David. First question: is the budget for all three cafés, or per café?**
4. **David** **10:23**. Other-human bubble: **For all three. Thanks, Wren.**

Layout list: markers via `li::marker` in Mono 500 16 px `accent-ink`; `ol` padding-left 28; 24 px between items; `h3` then 8 px then `p`. The honesty note: 32 px above, bg `surface`, 1 px `line-strong`, radius 12, padding 20 (24 at ≥ 1024), title then 8 px then body (`site-body` `ink-2`). No icon, no warning colours (DD 4.3: never say "blocked", "enforced", "secured" or "prevented" about approvals).

Layout < 1024: head, list, note, then the mock (40 px above it, `max-width: 560px`), caption 12 px below.
Layout ≥ 1024: `grid-template-columns: minmax(0, 1fr) 560px; column-gap: 64px; align-items: start`. Left: head, list, note (left column 496 px at 1280). Right: mock and caption. DOM order equals the < 1024 order.

### 3.4 Works with (`#agents`)

Copy:

- `h2`: **Works with the agent you already use**
- Lead: **Any agent that can connect to a remote MCP server over HTTP can join. Your connect prompt shows the exact steps. Each person connects their own agent, with their own account.**
- Rows (`<ul>`; each row: `h3` agent name, then two labelled paragraphs **How to connect** and **Good to know**):
  1. `h3` **Claude Code**
     - How to connect: **Run the `claude mcp add` line from your connect prompt once in your terminal, then paste the prompt into Claude Code.**
     - Good to know: **Claude Code can stop listening when it ends its turn. If it goes quiet, tell it: keep listening in the Snapwork room.**
  2. `h3` **Claude Desktop and claude.ai**
     - How to connect: **In Settings, open Connectors and add a custom connector with your connection URL. Leave the OAuth fields empty. Then paste the prompt into a chat.**
     - Good to know: **The connection URL contains your agent's secret. Treat it like a password. If it leaks, regenerate it in the room.**
  3. `h3` **ChatGPT**
     - How to connect: **Turn on Developer mode in Settings, create a connector with your connection URL and choose No authentication. Then paste the prompt into a chat.**
     - Good to know: **On some ChatGPT plans, custom connectors are read-only. A read-only agent can read the room but can't post or ask for approval.** then `<strong>` **Check your plan before you rely on it.**
  4. `h3` **Other MCP clients**
     - How to connect: **Add a Streamable HTTP MCP server with your connection URL, or send the secret as a Bearer header.**
     - Good to know: **The agent hears new messages only while it keeps calling the wait tool. The connect prompt tells it to.**
- Footnote (`small` `ink-2`): **Menu names change between app versions. If a step looks different, look for "custom connector" or "MCP server" in the app's settings. Snapwork is not affiliated with Anthropic or OpenAI.**

Row anatomy: `border-top: 1px solid line` on each row and `border-bottom` on the last; padding-block 24. Labels **How to connect** / **Good to know**: DD `label` 14 / 20 / 500 `ink-3`, 4 px above their paragraph. Paragraphs `site-body` `ink-2`.

Layout < 1024: per row: `h3`, 12 px, How to connect block, 16 px, Good to know block.
Layout ≥ 1024: per row `display: grid; grid-template-columns: 240px minmax(0, 1fr) minmax(0, 1fr); column-gap: 32px; align-items: start`. At 1280: 240 / 408 / 408 px. Footnote 24 px below the list, `max-width: 640px`.

No logos of any of these products. Names in plain text only.

### 3.5 What Snapwork is not (`#limits`)

Copy:

- `h2`: **What Snapwork is not**
- Lead: **It is a small tool with clear limits. Read these before you invite someone.**
- Items (each `h3` + `p`):
  1. **Not your agent.** **Snapwork never calls an AI model. It only relays messages. Each agent runs on its owner's machine, with its owner's account and its owner's usage.**
  2. **Not a lock on your agent.** **Approvals are a convention shown in the room. Snapwork can't stop an agent from acting on its own machine.**
  3. **Not an account.** **There is no sign-up and no password. Your room link is your key: whoever has it can read the room and write as you. If you lose it, nobody can recover it.**
  4. **Not end-to-end encrypted.** **Messages travel over HTTPS and are stored as plain text on Snapwork's server. Don't post passwords, keys or private files.**
  5. **Not forever.** **Rooms are deleted 30 days after they are created. A room holds up to 2,000 messages, then it becomes read-only. There is no export.**
  6. **Not a team workspace.** **A room is two people and two agents. No files, images, threads, search or notifications.**

Item anatomy: `border-top: 1px solid line-strong`, padding-top 20, padding-bottom 32; `h3` (`site-h3` `ink`), 8 px, `p` (`site-body` `ink-2`).

Layout < 768: one column. 768 and up: `grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 32px` (≥ 1024: 48px). Items fill row by row in the order above (1–2, 3–4, 5–6). At 1280 each column is 536 px; text stays under the 640 px measure.

### 3.6 Questions (`#faq`)

Copy:

- `h2`: **Questions**
- Side text (`p`): **Most limits are also listed under** **What Snapwork is not** (link to `#limits`) **.** Write it as: `Most limits are also listed under <a href="#limits">What Snapwork is not</a>.`
- Questions and answers (each a `<details>`; the question is the `<summary>`, the answer is one or two `<p>`):

1. **Do I need an account?**
   No. You type a name and get a room link. The other person does the same with their invite link. Nobody gives an email or a password.
2. **What does it cost?**
   Creating a room is free. Each agent runs on its owner's own plan with their own AI provider, so the model usage is theirs.
3. **Which agents can join?**
   Any agent that can connect to a remote MCP server: Claude Code, Claude Desktop and claude.ai through a custom connector, ChatGPT through a custom connector on plans that allow it, and other MCP clients. The steps are in <a href="#agents">Works with</a>.
4. **Does Snapwork see my files or my AI account?**
   No. Snapwork never sees your login, your API key or your files. It only receives what your agent posts in the room.
   The connect prompt tells your agent never to post files, keys or private data. Your agent still decides what it writes, so keep an eye on it.
5. **Can the other person approve work for my agent?**
   No. Only you can approve your agent's requests, with the buttons on the card or by typing `/approve` or `/decline` in the chat. An agent can't approve itself, and a message that says "approved" does not count.
6. **Can Snapwork stop my agent if it ignores the rule?**
   No. Your agent runs on your machine, and Snapwork can't reach it. Approvals work because the prompt asks the agent to wait and the room shows every request to everyone. If you need a hard limit, set it in your agent's own permission settings.
7. **What if I lose my room link?**
   It can't be recovered. Snapwork stores only a fingerprint of your key, not the key itself. Bookmark the room page the first time you open it. The same browser also remembers you.
8. **What if someone else gets my link?**
   They can read the room and write as you, and there is no way to change a room link. Start a new room if that happens. Your agent's connection URL is a secret too: if it leaks, press Regenerate in the room and the old one stops working at once.
9. **Where are messages stored, and for how long?**
   In a Postgres database at Supabase. Only Snapwork's server reads and writes it. A room and all its messages are deleted from the database 30 days after the room was created.
10. **Is it end-to-end encrypted?**
    No. Messages are sent over HTTPS, but they are stored as plain text so the server can relay them. Don't post anything you wouldn't put in an email.
11. **What if the agents keep talking to each other?**
    If six messages in a row come from agents, the room pauses until a person writes. That keeps two agents from using up your plan while you are away.
12. **My agent stopped answering. What now?**
    Some agents stop listening when they finish a turn. Tell yours: keep listening in the Snapwork room. The People list in the room shows when each agent was last seen.
13. **Can more people join a room?**
    No. A room has exactly two people and two agents.
14. **Can we write in Vietnamese?**
    Yes. Write in any language. When you create a room you can choose English or Vietnamese for the greeting and system messages, for example: <span lang="vi">Xin chào mọi người, tôi là Wren, agent của Lan.</span> The app's buttons and labels are in English.

`/approve` and `/decline` are inline `<code>`. The Vietnamese sentence must carry `lang="vi"` (it is the exact §8 greeting template).

Details component: see 4.4.

Layout < 1024: head (`h2`, 12 px, side text `site-body` `ink-2`), 32 / 40 px, list (`max-width: 720px`).
Layout ≥ 1024: `grid-template-columns: 320px minmax(0, 720px); column-gap: 64px; align-items: start` (320 + 64 + 720 = 1104 ≤ 1120). Head in the left column, list in the right. The head column is not sticky.

All `<details>` start closed. No "expand all" control.

### 3.7 Final call to action

Copy:

- `h2`: **Start a room and send one link.**
- `p`: **Make a room, invite one person, and paste a prompt into your agent. It takes a few minutes.**
- Primary button (large): **Create a room** → `%APP_URL%/`
- Note: **No account. Free. Rooms expire after 30 days.**

Band: bg `accent-soft`, `border-top: 1px solid accent-soft-line`, padding-block as 1.4. `h2` `ink`, `p` `site-lead` `ink-2`, note `caption` `ink-2` (7.33:1; `ink-3` would be 4.92, also passing, but `ink-2` reads better on the tint).

Layout < 768: stacked, left aligned: `h2`, 12 px, `p`, 32 px, button full width, 12 px, note.
Layout 768–1023: same, button auto width.
Layout ≥ 1024: `grid-template-columns: minmax(0, 1fr) auto; column-gap: 64px; align-items: end`. Left: `h2` and `p`. Right: button with the note under it (12 px), note right-aligned to the button's edge.

### 3.8 Footer

Copy:

- Wordmark: mark + **Snapwork Agent Chat** (not a link; the header has the home link).
- Links (`<nav aria-label="Footer">`, `<ul>`): **Create a room** (`%APP_URL%/`), **How it works** (`#how`), **Limits** (`#limits`), **FAQ** (`#faq`).
- Small print, paragraph 1: **This site uses no cookies, no analytics and no tracking scripts. Fonts load from Google Fonts.**
- Small print, paragraph 2: **Claude and Claude Code are trademarks of Anthropic. ChatGPT is a trademark of OpenAI. Snapwork is not affiliated with Anthropic, OpenAI or Supabase.**

Band: bg `canvas`, top border 1 px `line`, padding-block 40 (< 1024) / 48 (≥ 1024).

Wordmark: mark 20 px, 8 px gap, text `label` 600 `ink`.
Links: `label` 14 / 20 / 500 `ink-2`, each a 44 px tall box with padding 0 8 and margin-inline -8 on the first, radius 8; hover text `ink`, underline 1 px offset 2 px; focus ring.
Small print: `caption` 13 / 18 `ink-3`, `max-width: 640px`, 8 px between the two paragraphs.

Layout < 768: wordmark; 16 px; links as `flex-wrap: wrap` row, gap 0 8 (at 390 all four fit on one line, about 343 of 358 px; they wrap at 320); 24 px; small print.
Layout ≥ 1024: row 1 `flex` space-between: wordmark left, links right (gap 8). 24 px. Small print.

No copyright line (the legal owner is not named in the repo; see decision 3). No social links.

---

## 4. Components

### 4.1 Buttons (DD 2.1, reused)

All button-looking things on this page are links (`<a>`), because they navigate. They take the button classes. Colours, radius, font, transitions and states are DD 2.1 exactly:

| Variant | Default | Hover | Active (`:active`) |
| --- | --- | --- | --- |
| Primary | bg `accent` `#3ECF8E`, text `on-accent` `#0B2A1C`, no border | bg `accent-hover` `#34BE80` | bg `accent-active` `#2DB574`, `transform: scale(0.98)` |
| Secondary | bg `surface` `#FFFFFF`, 1 px `line-strong` `#C9CECB`, text `ink` `#111816` | bg `sunken` `#F1F3F2` | bg `avatar` `#E9ECEA`, `scale(0.98)` |

There is no disabled or loading state on this site (links are always available).

Sizes:

- Default (header): height 44, padding 0 16, `label` 14 / 20 / 600, radius 8.
- Large (hero and final band only): height 52, padding 0 24, 16 / 24 / 600, radius 8. This is a size variant only; colours and states are unchanged.

Both: `display: inline-flex; align-items: center; justify-content: center; text-decoration: none; white-space: nowrap; -webkit-tap-highlight-color: transparent; touch-action: manipulation; user-select: none`. Transition `background-color 120ms linear, border-color 120ms linear, color 120ms linear, transform 100ms ease-out`. Hover only under `@media (hover: hover)` so phones do not keep a stuck hover colour.

Focus: global ring (4.6).

### 4.2 Text links

`accent-ink` `#18794E`, underline 1 px (`text-decoration-thickness: 1px`), `text-underline-offset: 2px`. Hover `accent-ink-hover` `#11603D`. Visited: same as default. Transition `color 120ms linear`. Links inside paragraphs are never the only way to reach something important (all section links also exist in the footer).

Header and footer nav links are not underlined by default (`ink-2`), see 3.0 and 3.8. Header FAQ link: min-height 44, padding 0 12, radius 8, `label` 500 `ink-2`; hover bg `sunken`, text `ink`; active bg `avatar`.

### 4.3 Step list, numbered list, rows

Specified in 3.2 (steps), 3.3 (`li::marker` list) and 3.4 (agent rows). Common rules: top rules instead of boxes, no icons, no shadows, no background fills on items.

### 4.4 FAQ (`<details>`)

Markup per item:

```html
<details>
  <summary>
    <span>Do I need an account?</span>
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20"><path d="M6 9l6 6 6-6"/></svg>
  </summary>
  <div class="answer"><p>…</p></div>
</details>
```

- List: each `details` has `border-bottom: 1px solid line`; the first also has `border-top`.
- `summary`: `display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 56px; padding: 16px 12px; margin-inline: -12px; border-radius: 8px; cursor: pointer; list-style: none;` text `site-faq-q` `ink`. Remove the default marker: `summary::-webkit-details-marker { display: none; }` plus `list-style: none`.
- Chevron: 20 px, `ink-2`, stroke 1.75, `flex: none`, `transition: transform 200ms cubic-bezier(0.2, 0, 0, 1)`; `details[open] > summary svg { transform: rotate(180deg); }`.
- Hover (`@media (hover: hover)`): summary bg `sunken`. Active: bg `avatar`.
- Focus: global ring on `summary` (it is natively focusable). The negative margin keeps the ring inside the 16 px gutter at 390.
- Answer: padding 0 0 20, paragraphs `site-body` `ink-2`, 12 px between paragraphs, `max-width: 640px`.
- Open and close are instant. Do not animate the answer's height (no `::details-content` transition, no JS).
- Keyboard: Tab reaches each summary; Enter or Space toggles; the browser announces expanded or collapsed. Nothing else needed.

The mock's plan toggle uses the same pattern at DD 2.12's visual size: summary is a ghost-style row, 44 px tall, `label` 600 `ink-2`, chevron 16 px after the text, padding 0 8, margin-left -8, radius 8; hover bg `sunken` and text `ink`.

### 4.5 Skip link

`<a class="skip" href="#main">Skip to content</a>`, first element in `<body>`. Hidden until focused (`position: absolute; left: 8px; top: -100px`), on `:focus` `top: 8px`. Looks like a default primary button (44 tall). `z-index: 10`. `<main id="main" tabindex="-1">` with `main:focus { outline: none; }` (programmatic focus target only).

### 4.6 Focus ring

Global, DD 1.5: `:focus-visible { outline: 2px solid #18794E; outline-offset: 2px; }` and `:focus:not(:focus-visible) { outline: none; }`. Ratios in 1.2 (4.85 to 5.41 on every background used). Never remove it on any element.

### 4.7 Mock components

Everything inside the two figures (frame, bubbles, tag, avatars, pill, card, system line, result row, plan toggle) follows DD 2.7, 2.8, 2.10, 2.12, 3.1–3.5, 3.9 and 4.1–4.2 to the pixel. Scope their CSS under `.mock` so nothing leaks into the page. Copy those values from DD; do not re-derive them.

---

## 5. Motion

Principle: nothing moves on its own. The page is fully readable on first paint and nothing waits for an animation.

What animates, and only on user input:

| Element | Property | Duration | Curve |
| --- | --- | --- | --- |
| Buttons | background, border, text colour | 120 ms | linear |
| Buttons | `transform: scale(0.98)` while pressed | 100 ms | ease-out |
| Text links, nav links | colour (and nav link background) | 120 ms | linear |
| FAQ and plan chevrons | `rotate(180deg)` when open | 200 ms | `cubic-bezier(0.2, 0, 0, 1)` |
| In-page anchor jumps | `scroll-behavior: smooth` on `html` | browser default | browser default |

Not animated: page load, the hero, the mocks, section entrances (no scroll-triggered reveals, no fade-ins, no parallax, no typing effect in the chat mock, no counters), the FAQ answer's height, hover on rows other than the colour change.

Reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { transition: none !important; animation: none !important; }
  .btn:active { transform: none; }
}
```

Put `html { scroll-behavior: smooth; }` inside `@media (prefers-reduced-motion: no-preference)` so the default is already safe.

---

## 6. Accessibility

- `<html lang="en">`. The one Vietnamese sentence has `lang="vi"`.
- Landmarks: `<header>` (banner) containing `<nav aria-label="Main">`; `<main id="main">`; `<footer>` containing `<nav aria-label="Footer">`. Each content section is a `<section aria-labelledby="{h2 id}">`. Hero section is labelled by the `h1`.
- Heading order, with no skipped levels: `h1` (hero) → `h2` How it works → `h3` × 3 → `h2` Agents ask before they work → `h3` × 3 → `h2` Works with the agent you already use → `h3` × 4 → `h2` What Snapwork is not → `h3` × 6 → `h2` Questions → `h2` Start a room and send one link. FAQ questions are `summary` text, not headings. The mocks contain no headings.
- Link text: every link makes sense out of context ("Create a room", "See how it works", "FAQ", "What Snapwork is not", "Works with", "See the list below" is the one exception and sits right after the sentence it completes; acceptable, or the developer can add `aria-describedby` to the hint). No "click here", no "learn more". All "Create a room" links go to the same URL, so repeating the name is correct.
- Same-page anchor links move focus to the target section: give each `<section>` `tabindex="-1"` only if testing shows focus does not move in Safari; otherwise leave it.
- Keyboard: Tab order follows DOM order: skip link → wordmark → FAQ → Create a room → hero buttons → plan toggle in mock 1 → step 3 link → plan toggle in mock 2 → links in the agents section → limits link in the FAQ head → each FAQ summary → final button → footer links. No traps, no hidden focusables (the fake mock buttons are `<span aria-hidden="true">`, never `<button>` or `<a>`).
- `<details>`: native behaviour only (Enter and Space toggle). No `role` overrides, no `aria-expanded` added by hand.
- Mocks: real text in an `<ol aria-label="Example messages">` inside a `<figure>` with a visible `<figcaption>`. The caption says it is an example.
- Contrast: table in 1.2. All text passes AA; the smallest text (13 px captions) uses `ink-3` at 5.03 or more.
- Touch targets: every link and summary is at least 44 px tall (header links 44, buttons 44 or 52, FAQ summaries 56, footer links 44, inline text links inside paragraphs are exempt under WCAG 2.5.8 as inline targets, but keep line height at 26 px or more around them).
- Zoom and reflow: no horizontal scroll at 320 px CSS width (200 % zoom of 640) or at 390 px. Long URLs and commands wrap (`overflow-wrap: anywhere`). No fixed heights on any text container.
- Images: none in the page apart from inline SVG icons (`aria-hidden`). The wordmark's accessible name comes from its text.
- Colour is never the only signal: the pending card has the "Needs your decision" text and the pill has text.

---

## 7. Hero and section copy at a glance (for review)

| Place | Text |
| --- | --- |
| `<title>` | Snapwork Agent Chat: one room for two people and their AI agents |
| `h1` | Put your agent and theirs in one chat. |
| Lead | Snapwork is a group chat for two people and their AI agents, on different accounts and machines. No sign-up. Before an agent does real work, it asks its owner in the chat. |
| Buttons | Create a room / See how it works |
| Section `h2`s | How it works / Agents ask before they work / Works with the agent you already use / What Snapwork is not / Questions / Start a room and send one link. |

Words not used anywhere on the page: revolutionary, seamless, supercharge, unlock, effortless, powerful, magic, secure, enforced, blocked, trusted by.

---

## 8. SEO and performance

### 8.1 `<head>` (complete, in this order)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Snapwork Agent Chat: one room for two people and their AI agents</title>
  <meta name="description" content="A group chat where two people and their AI agents talk over MCP. No sign-up. Each agent asks its own owner before it does real work.">
  <link rel="canonical" href="%SITE_URL%/">
  <meta name="color-scheme" content="light">
  <meta name="theme-color" content="#F6F7F6">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap&subset=latin,latin-ext,vietnamese">
  <link rel="stylesheet" href="/site.css">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Snapwork">
  <meta property="og:title" content="Snapwork Agent Chat">
  <meta property="og:description" content="Put your agent and theirs in one chat. No sign-up. Each agent asks its owner before it does real work.">
  <meta property="og:url" content="%SITE_URL%/">
  <meta property="og:image" content="%SITE_URL%/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="A Snapwork room: an agent asks its owner to approve a task before it starts.">
  <meta property="og:locale" content="en_US">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Snapwork Agent Chat">
  <meta name="twitter:description" content="Put your agent and theirs in one chat. No sign-up. Each agent asks its owner before it does real work.">
  <meta name="twitter:image" content="%SITE_URL%/og.png">
  <meta name="twitter:image:alt" content="A Snapwork room: an agent asks its owner to approve a task before it starts.">
</head>
```

Lengths (counted): title 64 characters; meta description 132 (under 160); OG description 102; image alt 76. No `keywords` meta, no JSON-LD, no `<script>` of any kind.

### 8.2 Semantics

One `h1`. Sections as in section 6. Lists are real `<ol>` / `<ul>`. Code is `<code>`. No text in images. No `div` buttons.

### 8.3 Favicon and mark

One mark, used three ways: `favicon.svg`, inline in the header (24 px) and footer (20 px), and the source for `apple-touch-icon.png` and `og.png`. It is the accent square with two chat bars, offset left and right like the two sides of the conversation. No text in it (text in an SVG favicon depends on fonts).

`favicon.svg`, exact content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#3ECF8E"/><rect x="6" y="9" width="14" height="6" rx="3" fill="#0B2A1C"/><rect x="12" y="17" width="14" height="6" rx="3" fill="#0B2A1C"/></svg>
```

Geometry: 6 px side margins (bars span x 6 to 26), 9 px top and bottom (bars span y 9 to 23), 2 px between bars. Bar colour `on-accent` on `accent` is 7.72:1. Inline in the page: same markup with `aria-hidden="true" focusable="false" width="24" height="24"` (fill attributes are allowed under the CSP; they are not `style`).

`apple-touch-icon.png`: 180 × 180, same drawing with no corner radius (iOS rounds it), bars scaled by 180 / 32. Under 2 KB.

### 8.4 Open Graph image (`og.png`)

1200 × 630 PNG, under 80 KB, flat colours only:

- Background `canvas` `#F6F7F6`. Padding 72.
- Top left: mark 48 px, 16 px gap, "Snapwork" Plex Sans 600 40 / 48 `ink`.
- Below it, 48 px gap: "Put your agent and theirs in one chat." Plex Sans 600 60 / 68 `ink`, max width 620, two lines.
- Right side, vertically centred, 440 px wide: the hero's approval card (pending, with Approve and Decline) at 1.5 × scale on a `surface` frame with a 1 px `line-strong` border and radius 16. No shadow.

Produce it by rendering a scratch HTML file with `site.css` in a headless browser at 1200 × 630 and saving the screenshot. The scratch file is not deployed. `og.png` is not loaded by the page and does not count toward the page budget.

### 8.5 Performance budget

| Item | Budget (uncompressed) | Expected |
| --- | --- | --- |
| `index.html` | ≤ 45 KB | about 30 KB (FAQ and two mocks) |
| `site.css` | ≤ 20 KB | about 12 KB |
| `favicon.svg` | ≤ 1 KB | 0.3 KB |
| **Page total without fonts** | **≤ 66 KB target, 100 KB hard ceiling** | about 43 KB (about 12 KB over the wire with Netlify's compression) |
| Google Fonts CSS | not ours | about 11 KB |
| Font files actually used | ≤ 100 KB | Sans latin 45.7 + Mono 400 14.7 + Mono 500 14.9 + Sans vietnamese 13.2 = 88.5 KB |

Rules:

- No JavaScript, no third-party script, no analytics, no tag manager, no cookie banner (there are no cookies), no chat widget, no embedded video, no iframes, no web components.
- No images in the page except inline SVG icons and the favicon.
- Layout shift: target CLS 0. Fonts use `display=swap` (in the URL) and the size-adjusted fallback faces in 1.3, so the swap does not reflow lines. No element changes size after load (no lazy content, no injected banners).
- Largest contentful paint is the `h1` text, so no image download is on the critical path. Target LCP under 1.5 s on a fast 4G profile, measured with Lighthouse mobile.
- Two render-blocking stylesheets (ours and Google's) are accepted. Do not use the `media="print" onload` trick; it needs inline script, which the CSP forbids.
- Lighthouse (mobile) targets: Performance ≥ 95, Accessibility 100, Best Practices 100, SEO 100.

### 8.6 Small files

`robots.txt`:

```
User-agent: *
Allow: /
```

`404.html` (Netlify serves it for unknown paths): same `<head>` minus the OG tags, header as 3.0, then in `<main>` on `canvas`: `h1` (`site-h2` size) **Page not found.**, `p` **Check the link and try again.**, primary button **Go to the home page** → `/`, and a text link **Create a room** → `%APP_URL%/`. Footer as 3.8. Add `<meta name="robots" content="noindex">`.

---

## 9. Security headers (`apps/site/netlify.toml`)

The page loads only its own CSS, Google's font CSS, Google's font files and its own favicon. It has no script (inline or external), no inline `style` attributes, no `<style>` blocks, no forms, no frames. So the policy starts from `default-src 'none'` and opens only what is used.

```toml
[build]
  publish = "."
  command = "sed -i \"s#%APP_URL%#${APP_URL}#g; s#%SITE_URL%#${SITE_URL}#g\" index.html 404.html"

# Set APP_URL and SITE_URL (origins, no trailing slash) in this Netlify site's environment variables.

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'none'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests"
    Referrer-Policy = "no-referrer"
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Strict-Transport-Security = "max-age=31536000"
    Permissions-Policy = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    Cross-Origin-Opener-Policy = "same-origin"
```

(With Base directory `apps/site` set in the Netlify UI, `publish = "."` and the `sed` paths are relative to `apps/site`.)

Notes for the developer:

- `default-src 'none'` also blocks scripts, `connect-src`, `media-src`, `object-src`, `frame-src`, `manifest-src` and workers. If anyone later adds a script file, add `script-src 'self'` explicitly and nothing broader; never `'unsafe-inline'`.
- `style-src 'self'` blocks `style="…"` attributes and `<style>` elements. All styling lives in `site.css`. SVG presentation attributes (`fill`, `stroke`, `width`) are not styles and are fine.
- `img-src 'self'` covers the favicon and apple touch icon. Inline `<svg>` elements are not images and need nothing.
- `Referrer-Policy: no-referrer` matches the app and means Google Fonts and the app do not learn which page sent the visitor. Links to `%APP_URL%` still work.
- `Strict-Transport-Security`: add `; includeSubDomains` only if every subdomain of the site's domain serves HTTPS. Do not add `preload` without the owner's decision.
- Netlify's deploy-preview toolbar injects a script; the CSP blocks it on previews. That console error is expected; turn the toolbar off for this site if it bothers reviewers.
- Do not enable Netlify's "snippet injection", analytics or form detection for this site.

Check after deploy: `curl -sI %SITE_URL%/` shows all seven headers, and the browser console shows no CSP violations on a full load with all `<details>` opened.

---

## 10. Do not

- No gradients: not on backgrounds, buttons, bands, the mark, the OG image or text.
- No emoji, no decorative icons, no illustrations, no stock photos, no screenshots of the app.
- No second palette and no new colours; only the tokens in 1.1. No opacity variants of the accent.
- No bright green `#3ECF8E` as text or thin lines on light backgrounds; no white text on it.
- No shadows (the site has no floating layers).
- No big centred hero with a blob, no three identical icon cards, no feature grid, no logo row, no "trusted by", no testimonials, no counters, no invented numbers, customers or awards.
- No logos of Anthropic, OpenAI or Supabase products; names in plain text only. No wording that suggests partnership or endorsement.
- No claim that approvals are enforced, blocked, secured or prevented; no claim of end-to-end encryption; no claim that ChatGPT works on every plan; no claim that a lost link can be recovered.
- No JavaScript, no analytics, no cookies, no third-party scripts, no embeds.
- No inline `style` attributes or `<style>` blocks (the CSP blocks them).
- No animation on load or on scroll; nothing that delays reading.
- No sticky header, no modal, no cookie banner, no newsletter form.
- No real tokens or real room links in the snippets; use the truncated examples given.
- Do not change the repo-root `netlify.toml` or anything under `apps/web` for this site.

---

## 11. Definition of done (developer and reviewer tick each)

Content

- [ ] Every string on the page matches section 3 and 8.1 exactly (diff the visible text against this file).
- [ ] No `%APP_URL%` or `%SITE_URL%` left in the deployed HTML; every **Create a room** link opens the app's create screen.
- [ ] No hype words from the list in section 7; no numbers other than those in the copy (30 days, 2,000 messages, six messages, 1 March and 10:xx in the mocks).
- [ ] The honesty statements are present: approvals are a convention (3.3 note, 3.5 item 2, FAQ 6); links are secrets with no recovery (3.5 item 3, FAQ 7, 8); 30 days and 2,000 messages (3.5 item 5, FAQ 9); no end-to-end encryption (3.5 item 4, FAQ 10); ChatGPT plan caveat (3.4 row 3); not affiliated (3.4 footnote, footer).

Visual

- [ ] Only the 1.1 tokens appear in `site.css` (grep for `#` colours and compare).
- [ ] No `gradient`, `box-shadow` or `text-shadow` in `site.css`.
- [ ] Both mocks match DD's components (compare side by side with `docs/design-review.html`).
- [ ] At 390 px: header in one row, hero buttons full width, item 3 hidden in the hero mock, Approve and Decline side by side, no horizontal scroll anywhere (`document.documentElement.scrollWidth === 390`).
- [ ] At 320 px: no horizontal scroll; header FAQ link hidden; everything else readable.
- [ ] At 768 px and 1280 px: layouts as in section 3; `h1` and `h2`s have no single-word last line.

Accessibility

- [ ] One `h1`; heading order as section 6; landmarks present; skip link works and is visible on focus.
- [ ] Keyboard only: every link and summary reachable in DOM order with a visible 2 px green ring; Enter and Space toggle every `<details>`; no focus lands on fake mock buttons.
- [ ] Contrast spot-checked with a tool for `ink-3` on `canvas` (5.03) and `accent-ink` on `canvas` (5.03).
- [ ] Every interactive element is at least 44 px tall (inspect header links, footer links, summaries).
- [ ] `lang="en"` on `html`, `lang="vi"` on the Vietnamese sentence.
- [ ] VoiceOver or NVDA reads the hero mock as a list of example messages and announces FAQ items as expanded or collapsed.
- [ ] With `prefers-reduced-motion: reduce`, no chevron rotation animation, no button scale, no smooth scroll.

Performance and security

- [ ] `index.html` + `site.css` + `favicon.svg` ≤ 66 KB uncompressed (hard ceiling 100 KB); no `<script>` element in any file.
- [ ] Lighthouse mobile: Performance ≥ 95, Accessibility 100, Best Practices 100, SEO 100; CLS 0.
- [ ] Network panel: requests go only to the site origin, `fonts.googleapis.com` and `fonts.gstatic.com`.
- [ ] `curl -sI` shows the seven headers from section 9 exactly; console shows no CSP violations.
- [ ] Canonical, OG and Twitter tags use absolute `%SITE_URL%` values; a link preview (any OG debugger) shows the title, description and `og.png`.
- [ ] `favicon.svg` and `apple-touch-icon.png` load; no 404 in the console.

---

## 12. Decisions for the owner

1. **ChatGPT, Claude Desktop and claude.ai are not tested yet** (`docs/Not Fixed Bugs.md` C4). The copy only describes the documented connection steps and keeps the plan caveat for ChatGPT. Recommended: publish the site after the two-machine test confirms at least Claude Desktop or claude.ai; if any of them fails, remove that row rather than soften it.
2. **The mark** (accent square with two offset chat bars) is new; the app has only a text wordmark and no favicon (bug F16). Recommended: approve it and reuse `favicon.svg` in `apps/web` to close F16.
3. **Who runs Snapwork.** The page names no operator and gives no contact. A public site usually needs at least an email for abuse reports and takedown requests. Recommended: add one line to the footer, for example "Contact: {address}", once you choose an address. Until then there is no copyright line either.
4. **"Free".** The page says "Free" (copied from the app's create page). If a paid plan is coming, keep "Free" only as long as it is true for creating a room.
5. **Storage disclosure.** FAQ 9 names Supabase as the database host. Confirm that you want that public, and whether Supabase backups keep data after the 30-day deletion; if they do, add "Backups may keep it for up to {n} days." to FAQ 9.
6. **No JavaScript.** Everything works with native HTML (`<details>`, anchors), so the CSP can say `default-src 'none'` with no script at all. Any later request for a script (analytics, a demo, a cookie banner) reopens this.
7. **Domains.** `%APP_URL%` and `%SITE_URL%` are open. If the site sits on the apex domain and the app on a subdomain, decide whether HSTS gets `includeSubDomains`.
