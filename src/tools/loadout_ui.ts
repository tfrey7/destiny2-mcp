import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  LOADOUT_UI_MIME,
  LOADOUT_UI_RESOURCE_URI,
  renderLoadoutTemplate,
} from "../format/loadout/html.js";

/**
 * Register the MCP Apps loadout UI template as a readable `ui://` resource. A UI-capable host
 * fetches it once via `resources/read` (see the `_meta.ui.resourceUri` link on show_loadout /
 * show_equipped), renders it in a sandboxed iframe, and pushes each call's data to it. The
 * template is static and data-free; per-call loadout data rides in the tool's structuredContent.
 */
export function registerLoadoutUi(server: McpServer): void {
  server.registerResource(
    "loadout-ui",
    LOADOUT_UI_RESOURCE_URI,
    // resourceDomains declares the icon CDN per SEP-1865; icons are also inlined as data: URIs
    // because Claude Desktop ignores this field today and its sandbox blocks remote image hosts.
    {
      mimeType: LOADOUT_UI_MIME,
      _meta: { ui: { prefersBorder: true, csp: { resourceDomains: ["https://www.bungie.net"] } } },
    },
    (uri) => ({
      contents: [{ uri: uri.href, mimeType: LOADOUT_UI_MIME, text: renderLoadoutTemplate() }],
    }),
  );
}
