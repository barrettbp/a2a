import { API_URL } from "../config";

export interface ParsedPrompt {
  /** MCP URL with the agent token, only if the server gave one and it has exactly the expected shape */
  url: string | null;
  /** the text to paste into the agent (Step 2), or the whole prompt when Step 2 is not found */
  paste: string;
}

/**
 * The MCP URL ends up in an install command that people paste into a terminal, so it must be exactly
 * `{API_URL}/mcp/agt_{token}` and nothing else. The prompt text also holds names chosen by other people,
 * so a URL is never searched for inside it.
 */
export function safeMcpUrl(url: string | null | undefined, apiBase: string = API_URL): string | null {
  if (!url || !/^[A-Za-z0-9:/._-]+$/.test(url)) return null;
  const prefix = `${apiBase}/mcp/`;
  if (!url.startsWith(prefix)) return null;
  return /^agt_[A-Za-z0-9_-]{20,}$/.test(url.slice(prefix.length)) ? url : null;
}

export function parseConnectPrompt(prompt: string, mcpUrl: string | null, apiBase: string = API_URL): ParsedPrompt {
  const url = safeMcpUrl(mcpUrl, apiBase);
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
