import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProfile } from "../bungie/profile.js";
import { action, itemHashFor, TRANSFER_COMPONENTS } from "./actions.js";
import { ok } from "./response.js";

export function registerTransferItem(server: McpServer): void {
  server.registerTool(
    "transfer_item",
    {
      description:
        "Move an item between a character and the vault. itemId is its instance id (from list_inventory / get_equipped). Set transferToVault true to push to the vault, false to pull to the character. itemReferenceHash (the definition hash) is resolved from the instance automatically — only pass it to override. Transfers only run character↔vault, so moving gear from one character to another is two calls: push to vault, then pull to the other character.",
      inputSchema: {
        characterId: z.string(),
        itemId: z.string(),
        itemReferenceHash: z.number().int().optional(),
        transferToVault: z.boolean(),
        stackSize: z.number().int().min(1).default(1),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ characterId, itemId, itemReferenceHash, transferToVault, stackSize }) => {
      const profile = await getProfile(TRANSFER_COMPONENTS);
      const hash = itemReferenceHash ?? itemHashFor(profile, itemId);

      if (hash === undefined) {
        throw new Error(
          `[destiny2-mcp] No item with instance id ${itemId} found in any inventory, equipment, or the vault.`,
        );
      }

      const response = await action("/Destiny2/Actions/Items/TransferItem/", {
        characterId,
        itemId,
        itemReferenceHash: hash,
        transferToVault,
        stackSize,
      });
      const direction = transferToVault ? "to vault" : "to character";

      return ok(`Transferred item ${itemId} ${direction}.`, response);
    },
  );
}
