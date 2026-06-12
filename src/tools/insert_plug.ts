import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { action } from "./actions.js";
import { ok } from "./response.js";

export function registerInsertPlug(server: McpServer): void {
  server.registerTool(
    "insert_plug",
    {
      description:
        "Insert a plug into one of an item's sockets — the mechanism behind applying a shader or " +
        "ornament. Free and reversible: it changes only the socket, not the item's stats or perks. " +
        "Use inspect_sockets first to read the item's socketIndex and the plugItemHash of the plug " +
        "to insert; the plug must be one the player has unlocked. characterId and itemId (the item's " +
        "instance id) come from get_equipped / list_inventory.",
      inputSchema: {
        characterId: z.string(),
        itemId: z.string(),
        socketIndex: z.number().int().min(0),
        plugItemHash: z.number().int(),
      },
    },
    async ({ characterId, itemId, socketIndex, plugItemHash }) => {
      const response = await action("/Destiny2/Actions/Items/InsertSocketPlugFree/", {
        plug: { socketIndex, socketArrayType: 0, plugItemHash },
        itemId,
        characterId,
      });

      return ok(
        `Inserted plug ${plugItemHash} into socket ${socketIndex} of item ${itemId}.`,
        response,
      );
    },
  );
}
