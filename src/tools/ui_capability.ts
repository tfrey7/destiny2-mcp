import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * The MCP Apps extension identifier (SEP-1865, spec 2026-01-26). A UI-capable host
 * advertises it during the `initialize` handshake, under `capabilities.extensions`, with a
 * value declaring the mimeTypes it can render — Claude desktop sends
 * `{ "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } }`, which
 * matches the mimeType `card()` puts on its `ui://` resource. We read it back to decide
 * whether a tool may return the interactive card instead of plain text.
 */
const UI_EXTENSION = "io.modelcontextprotocol/ui";

/**
 * True when the connected client declared the MCP Apps UI extension. Claude Code (CLI) does
 * not, so every UI branch guarded by this is an automatic no-op in the terminal — the
 * existing text path is returned unchanged.
 */
export function clientSupportsUi(server: McpServer): boolean {
  const capabilities = server.server.getClientCapabilities();

  return Boolean(capabilities?.extensions?.[UI_EXTENSION]);
}
