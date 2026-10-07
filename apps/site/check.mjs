// Static checks for the site sources. Used by `pnpm typecheck` (this file run directly)
// and by the tests (imported). No dependencies.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fill, PLACEHOLDER } from "./build.mjs";

const here = dirname(fileURLToPath(import.meta.url));

// The only colours allowed on the site (docs/site-design.md 1.1).
export const TOKENS = [
  "#F6F7F6", "#FFFFFF", "#F1F3F2", "#E9ECEA", "#E2E5E3", "#C9CECB", "#111816", "#4A524E", "#646C68",
  "#3ECF8E", "#34BE80", "#2DB574", "#0B2A1C", "#18794E", "#11603D", "#E8F8F0", "#B7EBD2",
  "#8A4B05", "#FEF3E2", "#F3D19E",
];
export const KNOWN_PLACEHOLDERS = ["%APP_URL%", "%SITE_URL%"];
export const HEADER_NAMES = [
  "Content-Security-Policy", "Referrer-Policy", "X-Content-Type-Options", "X-Frame-Options",
  "Strict-Transport-Security", "Permissions-Policy", "Cross-Origin-Opener-Policy",
];

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u;

export function tags(html) {
  const out = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(html))) out.push({ name: m[2].toLowerCase(), closing: m[1] === "/", attrs: m[3], self: m[4] === "/", index: m.index });
  return out;
}

export function attr(attrs, name) {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(attrs);
  return m ? m[1] : null;
}

export function headingLevels(html) {
  return tags(html).filter((t) => !t.closing && /^h[1-6]$/.test(t.name)).map((t) => Number(t.name[1]));
}

export function htmlProblems(html, { allowRootRelative = false } = {}) {
  const problems = [];
  const all = tags(html);

  const stack = [];
  for (const t of all) {
    if (VOID.has(t.name) || t.self) continue;
    if (!t.closing) { stack.push(t.name); continue; }
    const open = stack.pop();
    if (open !== t.name) { problems.push(`tag mismatch: </${t.name}> closes <${open}> near offset ${t.index}`); break; }
  }
  if (stack.length) problems.push(`unclosed tags: ${stack.join(", ")}`);

  const levels = headingLevels(html);
  if (levels.filter((l) => l === 1).length !== 1) problems.push(`expected exactly one h1, found ${levels.filter((l) => l === 1).length}`);
  if (levels[0] !== 1) problems.push("first heading is not h1");
  levels.forEach((l, i) => { if (i > 0 && l > levels[i - 1] + 1) problems.push(`heading level skips from h${levels[i - 1]} to h${l}`); });

  const ids = all.map((t) => attr(t.attrs, "id")).filter(Boolean);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) problems.push(`duplicate ids: ${dup.join(", ")}`);
  for (const t of all.filter((t) => t.name === "a" && !t.closing)) {
    const href = attr(t.attrs, "href");
    if (href === null) { problems.push("<a> without href"); continue; }
    if (/^https:\/\/[^\s"<>]+$/.test(href) || /^mailto:[^\s"<>]+$/.test(href)) continue;
    if (href.startsWith("#") && ids.includes(href.slice(1))) continue;
    if (allowRootRelative && /^\/(#[a-z][a-z0-9-]*)?$/.test(href)) continue;
    if (href === "/" ) continue;
    problems.push(`bad link target: ${href}`);
  }

  if (/<script\b/i.test(html)) problems.push("<script> found");
  if (/<style\b/i.test(html)) problems.push("<style> block found");
  if (/\sstyle\s*=/i.test(html)) problems.push("inline style= attribute found");
  if (/\son[a-z]+\s*=/i.test(html)) problems.push("inline event handler found");

  const details = (html.match(/<details\b/g) || []).length;
  const withSummary = (html.match(/<details\b[^>]*>\s*<summary\b/g) || []).length;
  if (details !== withSummary) problems.push(`${details - withSummary} <details> without a leading <summary>`);

  if (!/<html lang="en">/.test(html)) problems.push('missing <html lang="en">');
  const left = html.match(PLACEHOLDER);
  if (left) problems.push(`placeholder left: ${[...new Set(left)].join(", ")}`);
  if (EMOJI.test(html)) problems.push("emoji character found");
  return problems;
}

export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

export function cssProblems(rawCss) {
  const problems = [];
  const css = stripComments(rawCss);
  let depth = 0;
  for (const ch of css) {
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth < 0) break;
  }
  if (depth !== 0) problems.push("unbalanced braces");
  if (/gradient\(/i.test(css)) problems.push("gradient found");
  if (/box-shadow|text-shadow/i.test(css)) problems.push("shadow found");
  if (/@import/i.test(css)) problems.push("@import found");
  if (/url\(/i.test(css)) problems.push("url() found (no images or remote files in the stylesheet)");
  for (const hex of css.match(/#[0-9a-fA-F]{3,8}\b/g) || []) {
    if (!TOKENS.includes(hex.toUpperCase())) problems.push(`colour not in the token list: ${hex}`);
  }
  const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  for (const m of css.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
    if (!defined.has(m[1])) problems.push(`undefined custom property: ${m[1]}`);
  }
  for (const m of css.matchAll(/(?:^|[;{\s])color\s*:\s*([^;}]+)/g)) {
    const v = m[1].trim();
    if (/#3ECF8E/i.test(v) || /var\(--color-accent\)/.test(v)) problems.push(`bright accent used as text colour: color: ${v}`);
  }
  if (EMOJI.test(css)) problems.push("emoji character found");
  return problems;
}

// Reads the [[headers]] values of a netlify.toml (simple key = "value" lines).
export function headerValues(toml) {
  const values = {};
  for (const m of toml.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"([^"]*)"\s*$/gm)) {
    if (HEADER_NAMES.includes(m[1])) values[m[1]] = m[2];
  }
  return values;
}

// The headers block from the spec (docs/site-design.md section 9), if the spec is present.
export function specHeaderValues() {
  const spec = join(here, "../../docs/site-design.md");
  if (!existsSync(spec)) return null;
  const block = /## 9\. Security headers[\s\S]*?```toml\n([\s\S]*?)```/.exec(readFileSync(spec, "utf8"));
  return block ? headerValues(block[1]) : null;
}

export function tomlProblems(toml) {
  const problems = [];
  const values = headerValues(toml);
  for (const name of HEADER_NAMES) if (!values[name]) problems.push(`header missing: ${name}`);
  const csp = values["Content-Security-Policy"] || "";
  if (/unsafe-inline|unsafe-eval/.test(csp)) problems.push("CSP allows unsafe-inline or unsafe-eval");
  if (!/default-src 'none'/.test(csp)) problems.push("CSP does not start from default-src 'none'");
  const spec = specHeaderValues();
  if (spec) for (const name of HEADER_NAMES) if (spec[name] !== values[name]) problems.push(`${name} differs from docs/site-design.md section 9`);
  if (!/^\s*publish\s*=\s*"dist"/m.test(toml)) problems.push('publish is not "dist"');
  return problems;
}

export const EXAMPLE = { appUrl: "https://app.example.com", siteUrl: "https://example.com" };

function checkSources() {
  const problems = [];
  for (const file of ["index.html", "404.html"]) {
    const src = readFileSync(join(here, file), "utf8");
    for (const p of new Set(src.match(PLACEHOLDER) || [])) {
      if (!KNOWN_PLACEHOLDERS.includes(p)) problems.push(`${file}: unknown placeholder ${p}`);
    }
    for (const p of htmlProblems(fill(src, EXAMPLE), { allowRootRelative: file === "404.html" })) problems.push(`${file}: ${p}`);
  }
  for (const p of cssProblems(readFileSync(join(here, "site.css"), "utf8"))) problems.push(`site.css: ${p}`);
  for (const p of tomlProblems(readFileSync(join(here, "netlify.toml"), "utf8"))) problems.push(`netlify.toml: ${p}`);
  for (const file of ["favicon.svg", "apple-touch-icon.png", "og.png", "robots.txt"]) {
    if (!existsSync(join(here, file))) problems.push(`missing file: ${file}`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkSources();
  if (problems.length) {
    console.error(`Site check failed:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  console.log("Site check passed.");
}
