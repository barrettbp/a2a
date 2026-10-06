export type Part = { type: "text"; value: string } | { type: "link"; value: string; href: string };

const URL_RE = /https?:\/\/[^\s<>"`]+/gi;
const CLOSERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

function count(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

/** Remove trailing punctuation; a closing bracket stays only when the URL has a matching opener. */
function trimUrl(raw: string): string {
  let u = raw;
  for (;;) {
    const last = u.at(-1);
    if (!last) return u;
    if (".,;:!?'\"".includes(last)) {
      u = u.slice(0, -1);
      continue;
    }
    const opener = CLOSERS[last];
    if (opener && count(u, last) > count(u, opener)) {
      u = u.slice(0, -1);
      continue;
    }
    return u;
  }
}

function safeHref(u: string): string | null {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Split plain text into text and http(s) link parts. Never produces HTML. */
export function autolink(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  const push = (value: string) => {
    if (!value) return;
    const prev = parts.at(-1);
    if (prev && prev.type === "text") prev.value += value;
    else parts.push({ type: "text", value });
  };
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const url = trimUrl(m[0]);
    const href = url.length > "https://".length ? safeHref(url) : null;
    push(text.slice(last, start));
    if (href) parts.push({ type: "link", value: url, href });
    else push(url);
    push(m[0].slice(url.length));
    last = start + m[0].length;
  }
  push(text.slice(last));
  return parts;
}
