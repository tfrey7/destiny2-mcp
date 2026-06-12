import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { json } from "../response.js";
import { findShaders } from "./logic.js";

export function registerFindShaders(server: McpServer): void {
  server.registerTool(
    "find_shaders",
    {
      description:
        "Find shaders by color scheme — the palette search the manifest can't do, since every shader's " +
        "text is identical boilerplate. Pass a color brief ('rusted copper', 'dark red and gold', " +
        "'pastel blue', 'monochrome black') and get back matching shaders ranked by fit, each with the " +
        "plugItemHash to apply. Palettes come from vision-captioning each shader's swatch icon, which " +
        "shows its colors and material feel (metallic/matte/weathered/iridescent) but NOT how the colors " +
        "land on a specific armor piece — no applied-to-armor preview exists, so treat results as palette " +
        "matches, not exact previews. Shaders are account-wide and class-agnostic. To apply one: " +
        "inspect_sockets on the target equipped item to get its shader socketIndex and confirm the plug " +
        "is unlocked, then insert_plug with this plugItemHash.",
      inputSchema: {
        query: z.string(),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, limit }) => {
      const shaders = await findShaders(query, limit ?? 12);

      return json({ query, count: shaders.length, shaders });
    },
  );
}
