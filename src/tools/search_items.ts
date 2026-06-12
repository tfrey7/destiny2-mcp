import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { isOwned, ownedGear } from "../bungie/acquisition.js";
import { searchItems, type OwnershipLookup } from "../bungie/manifest.js";
import { classNameSchema, elementSchema, itemCategorySchema, tierSchema } from "../schemas.js";
import { json } from "./response.js";

export function registerSearchItems(server: McpServer): void {
  server.registerTool(
    "search_items",
    {
      description:
        "Search the full Destiny 2 item catalog (the manifest, not the player's inventory) by attribute. Filter by any combination of name substring, element, item type (e.g. 'Trace Rifle'), tier, and category. Use this to enumerate gear that matches criteria — e.g. every exotic Strand weapon, or every shader matching a theme — rather than answering from memory. Pass owned:false to keep only gear the account has never acquired, or owned:true for gear it owns — ownership accounts for both held inventory and Collections, so it is the right signal for 'what am I missing' (don't diff inventory by hand). For armor, pass class (Warlock/Titan/Hunter) to keep only that class's gear plus class-agnostic pieces — the right way to narrow exotic armor to a single-class account. The cosmetic categories (shader, emblem, ornament, or cosmetic for all three) surface looks a player can apply; each result's itemHash is the plugItemHash for insert_plug (shaders/ornaments) or feeds how_to_acquire and inspect_item.",
      inputSchema: {
        name: z.string().optional(),
        element: elementSchema.optional(),
        type: z.string().optional(),
        tier: tierSchema.optional(),
        category: itemCategorySchema.optional(),
        class: classNameSchema.optional(),
        owned: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async (filters) => {
      let ownershipLookup: OwnershipLookup | undefined;

      if (filters.owned !== undefined) {
        const owned = await ownedGear();

        ownershipLookup = (entry) => isOwned(entry, owned);
      }

      const { count, truncated, items } = await searchItems(filters, ownershipLookup);
      const result = items.map((item) => ({
        name: item.name,
        tier: item.tier,
        type: item.type,
        element: item.element,
        slot: item.slot,
        ammoType: item.ammoType,
        classType: item.classType,
        itemHash: item.hash,
        ...(filters.owned !== undefined && { owned: filters.owned }),
      }));

      return json({ count, truncated, items: result });
    },
  );
}
