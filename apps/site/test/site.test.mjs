// Builds the site with test values and checks the output. Run: pnpm --filter @snapwork/site test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, FILES } from "../build.mjs";
import { tags, attr, headingLevels, htmlProblems, cssProblems, headerValues, specHeaderValues, stripComments, HEADER_NAMES } from "../check.mjs";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = "https://app.test-snapwork.example";
const SITE = "https://test-snapwork.example";
let out;
let html;
let notFound;
let css;

before(() => {
  out = mkdtempSync(join(tmpdir(), "snapwork-site-"));
  build({ appUrl: APP, siteUrl: SITE, outDir: out });
  html = readFileSync(join(out, "index.html"), "utf8");
  notFound = readFileSync(join(out, "404.html"), "utf8");
  css = readFileSync(join(out, "site.css"), "utf8");
});
after(() => rmSync(out, { recursive: true, force: true }));

const meta = (doc, key, name) => {
  const t = tags(doc).find((t) => t.name === "meta" && attr(t.attrs, key) === name);
  return t ? attr(t.attrs, "content") : null;
};

test("build writes every file into the output folder", () => {
  assert.deepEqual(readdirSync(out).sort(), [...FILES].sort());
});

test("placeholders are filled and none are left", () => {
  for (const file of ["index.html", "404.html", "site.css", "favicon.svg", "robots.txt"]) {
    const text = readFileSync(join(out, file), "utf8");
    assert.doesNotMatch(text, /%[A-Z][A-Z0-9_]*%/, file);
    assert.doesNotMatch(text, /\{\{|\}\}/, file);
  }
  assert.ok(html.includes(`href="${APP}/"`));
  assert.ok(html.includes(`<link rel="canonical" href="${SITE}/">`));
});

test("every Create a room link goes to the app", () => {
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>Create a room<\/a>/g)].map((m) => m[1]);
  assert.equal(links.length, 4);
  for (const href of links) assert.equal(href, `${APP}/`);
});

test("exactly one h1", () => {
  assert.equal(headingLevels(html).filter((l) => l === 1).length, 1);
  assert.equal(headingLevels(notFound).filter((l) => l === 1).length, 1);
});

test("heading order never skips a level", () => {
  for (const doc of [html, notFound]) {
    const levels = headingLevels(doc);
    assert.equal(levels[0], 1);
    for (let i = 1; i < levels.length; i++) assert.ok(levels[i] <= levels[i - 1] + 1, `h${levels[i - 1]} then h${levels[i]}`);
  }
  assert.deepEqual(headingLevels(html), [1, 2, 3, 3, 3, 2, 3, 3, 3, 2, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3, 2, 2]);
});

test("every link is https, an existing fragment, or mailto", () => {
  const ids = new Set(tags(html).map((t) => attr(t.attrs, "id")).filter(Boolean));
  for (const t of tags(html).filter((t) => t.name === "a" && !t.closing)) {
    const href = attr(t.attrs, "href");
    const ok = href === "/" || /^https:\/\//.test(href) || /^mailto:/.test(href) || (href.startsWith("#") && ids.has(href.slice(1)));
    assert.ok(ok, `bad href ${href}`);
  }
  const ids404 = new Set(tags(notFound).map((t) => attr(t.attrs, "id")).filter(Boolean));
  for (const t of tags(notFound).filter((t) => t.name === "a" && !t.closing)) {
    const href = attr(t.attrs, "href");
    const ok = /^https:\/\//.test(href) || /^\/(#[a-z]+)?$/.test(href) || (href.startsWith("#") && ids404.has(href.slice(1)));
    assert.ok(ok, `bad 404 href ${href}`);
  }
});

test("fragment links in the 404 page point at ids that exist on the home page", () => {
  const ids = new Set(tags(html).map((t) => attr(t.attrs, "id")).filter(Boolean));
  for (const m of notFound.matchAll(/href="\/#([^"]+)"/g)) assert.ok(ids.has(m[1]), m[1]);
});

test("no script, no style block, no inline style or event handler", () => {
  for (const doc of [html, notFound]) {
    assert.doesNotMatch(doc, /<script\b/i);
    assert.doesNotMatch(doc, /<style\b/i);
    assert.doesNotMatch(doc, /\sstyle\s*=/i);
    assert.doesNotMatch(doc, /\son[a-z]+\s*=/i);
  }
});

test("every details has a summary", () => {
  const details = html.match(/<details\b/g).length;
  assert.equal(details, 16); // 14 FAQ items and the plan toggle in each mock
  assert.equal(html.match(/<details\b[^>]*>\s*<summary\b/g).length, details);
});

test('html lang is "en" and the Vietnamese sentence has lang="vi"', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(notFound, /<html lang="en">/);
  assert.match(html, /<span lang="vi">Xin chào mọi người, tôi là Wren, agent của Lan\.<\/span>/);
});

test("head has title, description, canonical, Open Graph and Twitter tags", () => {
  assert.match(html, /<title>Snapwork Agent Chat: one room for two people and their AI agents<\/title>/);
  const description = meta(html, "name", "description");
  assert.ok(description && description.length < 160, `description length ${description?.length}`);
  assert.equal(meta(html, "property", "og:title"), "Snapwork Agent Chat");
  assert.ok(meta(html, "property", "og:description"));
  assert.equal(meta(html, "property", "og:url"), `${SITE}/`);
  assert.equal(meta(html, "property", "og:image"), `${SITE}/og.png`);
  assert.equal(meta(html, "name", "twitter:card"), "summary_large_image");
  assert.equal(meta(html, "name", "twitter:image"), `${SITE}/og.png`);
  assert.equal(meta(notFound, "name", "robots"), "noindex");
});

test("the CSS has no gradient and no shadow", () => {
  assert.doesNotMatch(css, /gradient\(/i);
  assert.doesNotMatch(css, /box-shadow|text-shadow/i);
});

test("the bright accent is never a text colour", () => {
  for (const m of stripComments(css).matchAll(/(?:^|[;{\s])color\s*:\s*([^;}]+)/g)) {
    assert.doesNotMatch(m[1], /#3ECF8E/i);
    assert.doesNotMatch(m[1], /var\(--color-accent\)/);
  }
});

test("the CSS uses only the spec colour tokens and defined custom properties", () => {
  assert.deepEqual(cssProblems(css), []);
});

test("no emoji characters", () => {
  const emoji = /[\p{Extended_Pictographic}\u{FE0F}]/u;
  for (const text of [html, notFound, css]) assert.doesNotMatch(text, emoji);
});

test("page weight is inside the spec budget (8.5)", () => {
  const size = (f) => statSync(join(out, f)).size;
  assert.ok(size("index.html") < 45 * 1024, `index.html ${size("index.html")} bytes`);
  assert.ok(size("site.css") < 20 * 1024, `site.css ${size("site.css")} bytes`);
  assert.ok(size("favicon.svg") <= 1024, `favicon.svg ${size("favicon.svg")} bytes`);
  assert.ok(size("index.html") + size("site.css") + size("favicon.svg") <= 66 * 1024);
  assert.ok(size("apple-touch-icon.png") < 2 * 1024, "apple-touch-icon.png");
  assert.ok(size("og.png") < 80 * 1024, "og.png");
});

test("the full HTML checks pass on the built pages", () => {
  assert.deepEqual(htmlProblems(html), []);
  assert.deepEqual(htmlProblems(notFound, { allowRootRelative: true }), []);
});

test("netlify.toml headers match the spec and the CSP has no unsafe sources", () => {
  const values = headerValues(readFileSync(join(siteDir, "netlify.toml"), "utf8"));
  for (const name of HEADER_NAMES) assert.ok(values[name], `missing ${name}`);
  assert.equal(
    values["Content-Security-Policy"],
    "default-src 'none'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests",
  );
  assert.doesNotMatch(values["Content-Security-Policy"], /unsafe-inline|unsafe-eval/);
  const spec = specHeaderValues();
  if (spec) assert.deepEqual(values, spec);
});

test("the checks catch real problems", () => {
  const bad = '<!doctype html><html lang="en"><body><h1>a</h1><h3>b</h3><a href="http://x.example">x</a><a href="#nope">y</a><details><p>z</p></details><div style="color:red"></div><script></script></body></html>';
  const problems = htmlProblems(bad).join("\n");
  for (const want of ["skips", "http://x.example", "#nope", "<details>", "inline style", "<script>"]) assert.ok(problems.includes(want), want);
  const cssBad = cssProblems(".a { color: #3ECF8E; background: linear-gradient(red, blue); border-color: #123456; width: var(--nope); }").join("\n");
  for (const want of ["text colour", "gradient", "#123456", "--nope"]) assert.ok(cssBad.includes(want), want);
});

const runBuild = (env) =>
  spawnSync(process.execPath, ["build.mjs"], { cwd: siteDir, env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });

test("the build fails loudly when a variable is missing or malformed", () => {
  for (const env of [{}, { APP_URL: APP }, { SITE_URL: SITE }, { APP_URL: `${APP}/`, SITE_URL: SITE }, { APP_URL: "http://app.example", SITE_URL: SITE }, { APP_URL: APP, SITE_URL: "%SITE_URL%" }]) {
    const r = runBuild(env);
    assert.equal(r.status, 1, JSON.stringify(env));
    assert.match(r.stderr, /Site build failed: (APP_URL|SITE_URL)/);
  }
});

test("the build fails when a placeholder would be left in the output", () => {
  const src = mkdtempSync(join(tmpdir(), "snapwork-site-src-"));
  try {
    execFileSync("cp", ["-r", ...FILES.map((f) => join(siteDir, f)), src]);
    execFileSync("sh", ["-c", `printf '<p>%%CONTACT_EMAIL%%</p>' >> "${join(src, "index.html")}"`]);
    assert.throws(() => build({ appUrl: APP, siteUrl: SITE, outDir: join(src, "dist"), srcDir: src }), /placeholder left in index\.html: %CONTACT_EMAIL%/);
  } finally {
    rmSync(src, { recursive: true, force: true });
  }
});

test("a real build into dist works from the command line", () => {
  const r = runBuild({ APP_URL: APP, SITE_URL: SITE });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(siteDir, "dist", "index.html")));
  rmSync(join(siteDir, "dist"), { recursive: true, force: true });
});
