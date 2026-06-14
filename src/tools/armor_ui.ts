import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ARMOR_UI_MIME, ARMOR_UI_RESOURCE_URI, renderArmorTemplate } from "../format/armor/html.js";

/**
 * Register the MCP Apps armor-inspect UI template as a readable `ui://` resource. A UI-capable host
 * fetches it once via `resources/read` (see the `_meta.ui.resourceUri` link on show_armor), renders
 * it in a sandboxed iframe, and pushes each call's data to it. The template is static and data-free;
 * per-call armor data rides in the tool's structuredContent. Mirrors registerWeaponUi.
 */
export function registerArmorUi(server: McpServer): void {
  server.registerResource(
    "armor-ui",
    ARMOR_UI_RESOURCE_URI,
    // resourceDomains declares the icon CDN per SEP-1865; icons are also inlined as data: URIs
    // because Claude Desktop ignores this field today and its sandbox blocks remote image hosts.
    {
      mimeType: ARMOR_UI_MIME,
      _meta: { ui: { prefersBorder: true, csp: { resourceDomains: ["https://www.bungie.net"] } } },
    },
    (uri) => ({
      contents: [{ uri: uri.href, mimeType: ARMOR_UI_MIME, text: renderArmorTemplate() }],
    }),
  );
}
