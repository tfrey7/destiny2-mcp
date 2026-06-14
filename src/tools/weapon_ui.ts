import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  renderWeaponTemplate,
  WEAPON_UI_MIME,
  WEAPON_UI_RESOURCE_URI,
} from "../format/weapon/html.js";

/**
 * Register the MCP Apps weapon-inspect UI template as a readable `ui://` resource. A UI-capable host
 * fetches it once via `resources/read` (see the `_meta.ui.resourceUri` link on show_weapon), renders
 * it in a sandboxed iframe, and pushes each call's data to it. The template is static and data-free;
 * per-call weapon data rides in the tool's structuredContent. Mirrors registerLoadoutUi.
 */
export function registerWeaponUi(server: McpServer): void {
  server.registerResource(
    "weapon-ui",
    WEAPON_UI_RESOURCE_URI,
    // resourceDomains declares the icon CDN per SEP-1865; icons are also inlined as data: URIs
    // because Claude Desktop ignores this field today and its sandbox blocks remote image hosts.
    {
      mimeType: WEAPON_UI_MIME,
      _meta: { ui: { prefersBorder: true, csp: { resourceDomains: ["https://www.bungie.net"] } } },
    },
    (uri) => ({
      contents: [{ uri: uri.href, mimeType: WEAPON_UI_MIME, text: renderWeaponTemplate() }],
    }),
  );
}
