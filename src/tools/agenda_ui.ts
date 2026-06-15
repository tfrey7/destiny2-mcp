import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  AGENDA_UI_MIME,
  AGENDA_UI_RESOURCE_URI,
  renderAgendaTemplate,
} from "../format/agenda/html.js";

/**
 * Register the MCP Apps agenda UI template as a readable `ui://` resource. A UI-capable host fetches
 * it once via `resources/read` (see the `_meta.ui.resourceUri` link on show_agenda), renders it in a
 * sandboxed iframe, and pushes each call's data to it. The template is static and data-free; per-call
 * agenda data rides in the tool's structuredContent. No `csp.resourceDomains` is declared because every
 * icon is inlined as a data: URI (Claude Desktop ignores that field and blocks remote image hosts).
 */
export function registerAgendaUi(server: McpServer): void {
  server.registerResource(
    "agenda-ui",
    AGENDA_UI_RESOURCE_URI,
    {
      mimeType: AGENDA_UI_MIME,
      _meta: { ui: { prefersBorder: true } },
    },
    (uri) => ({
      contents: [{ uri: uri.href, mimeType: AGENDA_UI_MIME, text: renderAgendaTemplate() }],
    }),
  );
}
