// Builds the static site into dist/: copies the files and fills in %APP_URL% and %SITE_URL%.
// Usage: APP_URL=https://app.example.com SITE_URL=https://example.com node build.mjs
// Fails (exit 1) if a variable is missing or malformed, or if any placeholder is left in the output.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const FILES = ["index.html", "404.html", "site.css", "favicon.svg", "apple-touch-icon.png", "og.png", "robots.txt"];
const TEXT = /\.(html|css|svg|txt)$/;
export const PLACEHOLDER = /%[A-Z][A-Z0-9_]*%|\{\{[^}]*\}\}/g;

export function checkOrigin(name, value) {
  if (!value) throw new Error(`${name} is not set. Set it to an https origin with no trailing slash, for example https://example.com.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a valid URL: ${value}`);
  }
  if (url.protocol !== "https:" || url.origin !== value) {
    throw new Error(`${name} must be an https origin with no path and no trailing slash (lower case), for example https://example.com. Got: ${value}`);
  }
}

export function fill(text, { appUrl, siteUrl }) {
  return text.replaceAll("%APP_URL%", appUrl).replaceAll("%SITE_URL%", siteUrl);
}

export function build({ appUrl, siteUrl, outDir = join(here, "dist"), srcDir = here }) {
  checkOrigin("APP_URL", appUrl);
  checkOrigin("SITE_URL", siteUrl);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const file of FILES) {
    const from = join(srcDir, file);
    const to = join(outDir, file);
    if (!TEXT.test(file)) {
      copyFileSync(from, to);
      continue;
    }
    const text = fill(readFileSync(from, "utf8"), { appUrl, siteUrl });
    const left = text.match(PLACEHOLDER);
    if (left) throw new Error(`placeholder left in ${file}: ${[...new Set(left)].join(", ")}`);
    writeFileSync(to, text);
  }
  return outDir;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const out = build({ appUrl: process.env.APP_URL, siteUrl: process.env.SITE_URL });
    console.log(`Site built into ${out} (APP_URL=${process.env.APP_URL}, SITE_URL=${process.env.SITE_URL}).`);
  } catch (err) {
    console.error(`Site build failed: ${err.message}`);
    process.exit(1);
  }
}
