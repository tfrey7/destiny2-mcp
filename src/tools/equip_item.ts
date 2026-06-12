import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProfile } from "../bungie/profile.js";
import { action, ensureOnCharacter, TRANSFER_COMPONENTS } from "./actions.js";
import { ok } from "./response.js";

export function registerEquipItem(server: McpServer): void {
  server.registerTool(
    "equip_item",
    {
      description:
        "Equip a single item on a character by its item instance id (from list_inventory / get_equipped). The item is moved onto the character automatically if it sits in the vault or on another character, so no transfer_item call is needed first. If the destination bucket is full, a duplicate of the same item is bumped to the vault to make room; otherwise the equip fails asking you to name an item to move.",
      inputSchema: {
        characterId: z.string(),
        itemId: z.string(),
      },
    },
    async ({ characterId, itemId }) => {
      const profile = await getProfile(TRANSFER_COMPONENTS);
      const note = await ensureOnCharacter(profile, characterId, itemId);
      const response = await action("/Destiny2/Actions/Items/EquipItem/", { characterId, itemId });

      return ok(`${note}Equipped item ${itemId} on character ${characterId}.`, response);
    },
  );
}
