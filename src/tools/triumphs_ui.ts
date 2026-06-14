import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  TRIUMPHS_UI_MIME,
  TRIUMPHS_UI_RESOURCE_URI,
  renderTriumphTemplate,
} from "../format/triumphs/index.js";

/**
 * Register the MCP Apps Triumph-grid UI template as a readable `ui://` resource. A UI-capable host
 * fetches it once via `resources/read` (see the `_meta.ui.resourceUri` link on show_triumphs),
 * renders it in a sandboxed iframe, and pushes each call's data to it. The template is static and
 * data-free; per-call Triumph data rides in the tool's structuredContent.
 */
export function registerTriumphsUi(server: McpServer): void {
  server.registerResource(
    "triumphs-ui",
    TRIUMPHS_UI_RESOURCE_URI,
    // resourceDomains declares the icon CDN per SEP-1865; icons are also inlined as data: URIs
    // because Claude Desktop ignores this field today and its sandbox blocks remote image hosts.
    {
      mimeType: TRIUMPHS_UI_MIME,
      _meta: { ui: { prefersBorder: true, csp: { resourceDomains: ["https://www.bungie.net"] } } },
    },
    (uri) => ({
      contents: [{ uri: uri.href, mimeType: TRIUMPHS_UI_MIME, text: renderTriumphTemplate() }],
    }),
  );
}
