export interface ParsedPrompt {
  /** MCP URL with the agent token, or null if the prompt has an unexpected shape */
  url: string | null;
  /** the text to paste into the agent (Step 2), or the whole prompt when Step 2 is not found */
  paste: string;
}

const URL_RE = /https?:\/\/[^\s]*\/mcp\/agt_[A-Za-z0-9_-]+/;

export function parseConnectPrompt(prompt: string): ParsedPrompt {
  const url = prompt.match(URL_RE)?.[0] ?? null;
  const lines = prompt.split("\n");
  const i = lines.findIndex((l) => l.startsWith("Step 2"));
  if (i === -1) return { url, paste: prompt };
  const paste = lines
    .slice(i + 1)
    .map((l) => (l.startsWith("  ") ? l.slice(2) : l))
    .join("\n")
    .trim();
  return { url, paste: paste || prompt };
}

export const installCommand = (url: string) => `claude mcp add --transport http snapwork ${url}`;
