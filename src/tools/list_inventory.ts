import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClassType, Component, getProfile } from "../bungie/profile.js";
import { inventoryItems, type InventoryItem } from "./inventory.js";
import { json } from "./response.js";

export function registerListInventory(server: McpServer): void {
  server.registerTool(
    "list_inventory",
    {
      description:
        "List items in character inventories and the vault. Filter by any combination of character, case-insensitive name search, element, item type (e.g. 'Auto Rifle'), and tier. Each item also reports its element, type, and tier so results can be refined without inspect_item. The full inventory is large: narrow with filters, or pass summary:true to get counts by element/type/slot/tier instead of the item list. Results are capped at `limit` (default 200) with a `truncated` flag.",
      inputSchema: {
        characterId: z.string().optional(),
        search: z.string().optional(),
        element: z
          .enum(["Kinetic", "Arc", "Solar", "Void", "Stasis", "Strand", "Prismatic"])
          .optional(),
        type: z.string().optional(),
        tier: z.enum(["Exotic", "Legendary", "Rare", "Uncommon", "Common"]).optional(),
        summary: z.boolean().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      },
    },
    async ({ characterId, search, element, type, tier, summary, limit }) => {
      const profile = await getProfile([
        Component.Characters,
        Component.CharacterInventories,
        Component.ProfileInventories,
      ]);

      const term = search?.toLowerCase();
      const typeTerm = type?.toLowerCase();
      const matches = (item: InventoryItem) =>
        (!term || item.name.toLowerCase().includes(term)) &&
        (!element || item.element === element) &&
        (!typeTerm || (item.type ?? "").toLowerCase().includes(typeTerm)) &&
        (!tier || item.tier === tier);

      const inventories = profile.characterInventories?.data ?? {};
      const charGroups = await Promise.all(
        Object.entries(inventories)
          .filter(([id]) => !characterId || id === characterId)
          .map(async ([id, bucket]) => ({
            characterId: id,
            class: ClassType[profile.characters?.data?.[id]?.classType ?? -1] ?? "Unknown",
            items: (await inventoryItems(bucket.items)).filter(matches),
          })),
      );
      const vaultItems = (await inventoryItems(profile.profileInventory?.data?.items ?? [])).filter(
        matches,
      );

      if (summary) {
        const all = [...charGroups.flatMap((group) => group.items), ...vaultItems];
        const tally = (key: keyof InventoryItem) => {
          const counts: Record<string, number> = {};

          for (const item of all) {
            const value = item[key];

            if (typeof value === "string") {
              counts[value] = (counts[value] ?? 0) + 1;
            }
          }

          return counts;
        };

        return json({
          total: all.length,
          byElement: tally("element"),
          byType: tally("type"),
          bySlot: tally("slot"),
          byTier: tally("tier"),
        });
      }

      const cap = limit ?? 200;
      const total =
        charGroups.reduce((sum, group) => sum + group.items.length, 0) + vaultItems.length;
      let budget = cap;
      const take = (items: InventoryItem[]) => {
        const slice = items.slice(0, Math.max(0, budget));

        budget -= slice.length;
        return slice;
      };

      const characters = charGroups.map((group) => ({ ...group, items: take(group.items) }));
      const vault = take(vaultItems);

      return json({
        total,
        truncated: total > cap,
        ...(total > cap
          ? { note: `Showing ${cap} of ${total} items. Narrow with filters or use summary:true.` }
          : {}),
        characters,
        vault,
      });
    },
  );
}
