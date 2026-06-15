import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  TITLES_UI_MIME,
  TITLES_UI_RESOURCE_URI,
  renderTitlesTemplate,
} from "../format/titles/index.js";

/**
 * Register the MCP Apps Titles-gallery UI template as a readable `ui://` resource. A UI-capable host
 * fetches it once via `resources/read` (see the `_meta.ui.resourceUri` link on show_titles), renders
 * it in a sandboxed iframe, and pushes each call's data to it. The template is static and data-free;
 * per-call title data rides in the tool's structuredContent.
 */
export function registerTitlesUi(server: McpServer): void {
  server.registerResource(
    "titles-ui",
    TITLES_UI_RESOURCE_URI,
    // resourceDomains declares the icon CDN per SEP-1865; icons are also inlined as data: URIs
    // because Claude Desktop ignores this field today and its sandbox blocks remote image hosts.
    {
      mimeType: TITLES_UI_MIME,
      _meta: { ui: { prefersBorder: true, csp: { resourceDomains: ["https://www.bungie.net"] } } },
    },
    (uri) => ({
      contents: [{ uri: uri.href, mimeType: TITLES_UI_MIME, text: renderTitlesTemplate() }],
    }),
  );
}
