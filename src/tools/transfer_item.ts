import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { action } from "./actions.js";
import { ok } from "./response.js";

export function registerTransferItem(server: McpServer): void {
  server.registerTool(
    "transfer_item",
    {
      description:
        "Move an item between a character and the vault. itemReferenceHash is the item's definition hash; itemId is its instance id. Set transferToVault true to push to the vault, false to pull to the character. Transfers only run character↔vault, so moving gear from one character to another is two calls: push to vault, then pull to the other character.",
      inputSchema: {
        characterId: z.string(),
        itemId: z.string(),
        itemReferenceHash: z.number().int(),
        transferToVault: z.boolean(),
        stackSize: z.number().int().min(1).default(1),
      },
    },
    async ({ characterId, itemId, itemReferenceHash, transferToVault, stackSize }) => {
      const response = await action("/Destiny2/Actions/Items/TransferItem/", {
        characterId,
        itemId,
        itemReferenceHash,
        transferToVault,
        stackSize,
      });
      const direction = transferToVault ? "to vault" : "to character";

      return ok(`Transferred item ${itemId} ${direction}.`, response);
    },
  );
}
