import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchItems } from "../bungie/manifest.js";
import { elementSchema, itemCategorySchema, tierSchema } from "../schemas.js";
import { json } from "./response.js";

export function registerSearchItems(server: McpServer): void {
  server.registerTool(
    "search_items",
    {
      description:
        "Search the full Destiny 2 item catalog (the manifest, not the player's inventory) by attribute. Filter by any combination of name substring, element, item type (e.g. 'Trace Rifle'), tier, and category. Use this to enumerate gear that matches criteria — e.g. every exotic Strand weapon, or every shader matching a theme — rather than answering from memory. The cosmetic categories (shader, emblem, ornament, or cosmetic for all three) surface looks a player can apply; each result's itemHash is the plugItemHash for insert_plug (shaders/ornaments) or feeds how_to_acquire and inspect_item.",
      inputSchema: {
        name: z.string().optional(),
        element: elementSchema.optional(),
        type: z.string().optional(),
        tier: tierSchema.optional(),
        category: itemCategorySchema.optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async (filters) => {
      const { count, truncated, items } = await searchItems(filters);
      const result = items.map((item) => ({
        name: item.name,
        tier: item.tier,
        type: item.type,
        element: item.element,
        slot: item.slot,
        ammoType: item.ammoType,
        itemHash: item.hash,
      }));

      return json({ count, truncated, items: result });
    },
  );
}
