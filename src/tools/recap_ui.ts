import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  RECAP_UI_MIME,
  RECAP_UI_RESOURCE_URI,
  renderRecapTemplate,
} from "../format/recap/index.js";

/**
 * Register the MCP Apps activity-recap UI template as a readable `ui://` resource. A UI-capable host
 * fetches it once via `resources/read` (see the `_meta.ui.resourceUri` link on activity_recap),
 * renders it in a sandboxed iframe, and pushes each call's data to it. The template is static and
 * data-free; per-call recap data rides in the tool's structuredContent.
 */
export function registerRecapUi(server: McpServer): void {
  server.registerResource(
    "recap-ui",
    RECAP_UI_RESOURCE_URI,
    // resourceDomains declares the icon CDN per SEP-1865; the PGCR backdrop is also inlined as a
    // data: URI because Claude Desktop ignores this field today and its sandbox blocks remote hosts.
    {
      mimeType: RECAP_UI_MIME,
      _meta: { ui: { prefersBorder: true, csp: { resourceDomains: ["https://www.bungie.net"] } } },
    },
    (uri) => ({
      contents: [{ uri: uri.href, mimeType: RECAP_UI_MIME, text: renderRecapTemplate() }],
    }),
  );
}
