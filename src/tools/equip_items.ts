import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProfile } from "../bungie/profile.js";
import { action, ensureOnCharacter, TRANSFER_COMPONENTS } from "./actions.js";
import { ok } from "./response.js";

export function registerEquipItems(server: McpServer): void {
  server.registerTool(
    "equip_items",
    {
      description:
        "Equip several items on a character at once by their item instance ids. Each item is moved onto the character automatically if it sits in the vault or on another character, so no transfer_item calls are needed first. A full destination bucket is cleared by bumping a duplicate of the same item to the vault; otherwise the equip fails asking you to name an item to move.",
      inputSchema: {
        characterId: z.string(),
        itemIds: z.array(z.string()).min(1),
      },
    },
    async ({ characterId, itemIds }) => {
      const profile = await getProfile(TRANSFER_COMPONENTS);
      // Each requested item targets a distinct equip slot, so their buckets don't overlap and the
      // single profile snapshot stays accurate across the pulls.
      const notes = await Promise.all(
        itemIds.map((itemId) => ensureOnCharacter(profile, characterId, itemId)),
      );
      const response = await action("/Destiny2/Actions/Items/EquipItems/", {
        characterId,
        itemIds,
      });

      return ok(
        `${notes.join("")}Equipped ${itemIds.length} item(s) on character ${characterId}.`,
        response,
      );
    },
  );
}
