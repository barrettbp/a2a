import { describe, expect, it } from "vitest";
import { connectPrompt } from "@snapwork/shared";
import { parseConnectPrompt } from "../lib/prompt";

describe("parseConnectPrompt", () => {
  const p = connectPrompt({
    roomName: "Acme",
    ownerName: "Barrett",
    otherName: null,
    agentName: "Claude",
    agentToken: "agt_abcDEF123-_",
    apiUrl: "https://api.example.com",
  });
  it("finds the MCP URL", () => {
    expect(parseConnectPrompt(p).url).toBe("https://api.example.com/mcp/agt_abcDEF123-_");
  });
  it("extracts and dedents step 2", () => {
    const { paste } = parseConnectPrompt(p);
    expect(paste.startsWith("Join the Snapwork room")).toBe(true);
    expect(paste).toContain("Rules:");
    expect(paste).not.toContain("Step 1");
  });
  it("falls back to the whole text", () => {
    expect(parseConnectPrompt("hello")).toEqual({ url: null, paste: "hello" });
  });
});
