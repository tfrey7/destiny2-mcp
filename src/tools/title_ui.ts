import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  TITLE_UI_MIME,
  TITLE_UI_RESOURCE_URI,
  renderTitleTemplate,
} from "../format/title/index.js";

/**
 * Register the MCP Apps single-title UI template as a readable `ui://` resource. A UI-capable host
 * fetches it once via `resources/read` (see the `_meta.ui.resourceUri` link on show_title), renders
 * it in a sandboxed iframe, and pushes each call's data to it. The template is static and data-free;
 * per-call title data rides in the tool's structuredContent.
 */
export function registerTitleUi(server: McpServer): void {
  server.registerResource(
    "title-ui",
    TITLE_UI_RESOURCE_URI,
    // resourceDomains declares the icon CDN per SEP-1865; icons are also inlined as data: URIs
    // because Claude Desktop ignores this field today and its sandbox blocks remote image hosts.
    {
      mimeType: TITLE_UI_MIME,
      _meta: { ui: { prefersBorder: true, csp: { resourceDomains: ["https://www.bungie.net"] } } },
    },
    (uri) => ({
      contents: [{ uri: uri.href, mimeType: TITLE_UI_MIME, text: renderTitleTemplate() }],
    }),
  );
}
