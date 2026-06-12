import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClassType, Component, getProfile } from "../bungie/profile.js";
import { inventoryItems } from "./inventory.js";
import { json } from "./response.js";

export function registerGetEquipped(server: McpServer): void {
  server.registerTool(
    "get_equipped",
    {
      description:
        "List the currently equipped items for each character. Each item reports its slot, element, type, and tier, so element matching and the one-exotic-weapon limit can be reasoned about directly — no follow-up inspect_item needed for those attributes.",
      inputSchema: { characterId: z.string().optional() },
    },
    async ({ characterId }) => {
      const profile = await getProfile([Component.Characters, Component.CharacterEquipment]);
      const equipment = profile.characterEquipment?.data ?? {};

      const entries = Object.entries(equipment).filter(
        ([id]) => !characterId || id === characterId,
      );
      const result = await Promise.all(
        entries.map(async ([id, bucket]) => ({
          characterId: id,
          class: ClassType[profile.characters?.data?.[id]?.classType ?? -1] ?? "Unknown",
          equipped: await inventoryItems(bucket.items),
        })),
      );

      return json(result);
    },
  );
}
