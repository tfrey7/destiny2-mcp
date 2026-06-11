import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { bungieFetch } from "../bungie/client.js";
import { getPrimaryMembership } from "../bungie/profile.js";

function ok(message: string, response: unknown) {
  return { content: [{ type: "text" as const, text: `${message}\n${JSON.stringify(response, null, 2)}` }] };
}

async function action(path: string, body: Record<string, unknown>): Promise<unknown> {
  const { membershipType } = await getPrimaryMembership();
  return bungieFetch(path, { method: "POST", body: { ...body, membershipType } });
}

export function registerWriteTools(server: McpServer): void {
  server.registerTool(
    "equip_loadout",
    {
      description: "Equip one of a character's saved in-game loadout slots. Find the loadoutIndex via list_loadouts.",
      inputSchema: {
        characterId: z.string(),
        loadoutIndex: z.number().int().min(0),
      },
    },
    async ({ characterId, loadoutIndex }) => {
      const response = await action("/Destiny2/Actions/Loadouts/EquipLoadout/", { characterId, loadoutIndex });
      return ok(`Equipped loadout ${loadoutIndex} on character ${characterId}.`, response);
    },
  );

  server.registerTool(
    "snapshot_loadout",
    {
      description:
        "Save the character's currently equipped gear into a loadout slot, overwriting whatever is in that slot.",
      inputSchema: {
        characterId: z.string(),
        loadoutIndex: z.number().int().min(0),
      },
    },
    async ({ characterId, loadoutIndex }) => {
      const response = await action("/Destiny2/Actions/Loadouts/SnapshotLoadout/", { characterId, loadoutIndex });
      return ok(`Snapshotted current gear into loadout ${loadoutIndex} on character ${characterId}.`, response);
    },
  );

  server.registerTool(
    "update_loadout_identifiers",
    {
      description:
        "Change a loadout's name, color, or icon. Values are manifest hashes (DestinyLoadout{Name,Color,Icon}Definition).",
      inputSchema: {
        characterId: z.string(),
        loadoutIndex: z.number().int().min(0),
        nameHash: z.number().int().optional(),
        colorHash: z.number().int().optional(),
        iconHash: z.number().int().optional(),
      },
    },
    async ({ characterId, loadoutIndex, nameHash, colorHash, iconHash }) => {
      const response = await action("/Destiny2/Actions/Loadouts/UpdateLoadoutIdentifiers/", {
        characterId,
        loadoutIndex,
        nameHash,
        colorHash,
        iconHash,
      });
      return ok(`Updated identifiers for loadout ${loadoutIndex} on character ${characterId}.`, response);
    },
  );

  server.registerTool(
    "equip_item",
    {
      description: "Equip a single item on a character by its item instance id (from list_inventory / get_equipped).",
      inputSchema: {
        characterId: z.string(),
        itemId: z.string(),
      },
    },
    async ({ characterId, itemId }) => {
      const response = await action("/Destiny2/Actions/Items/EquipItem/", { characterId, itemId });
      return ok(`Equipped item ${itemId} on character ${characterId}.`, response);
    },
  );

  server.registerTool(
    "equip_items",
    {
      description: "Equip several items on a character at once by their item instance ids.",
      inputSchema: {
        characterId: z.string(),
        itemIds: z.array(z.string()).min(1),
      },
    },
    async ({ characterId, itemIds }) => {
      const response = await action("/Destiny2/Actions/Items/EquipItems/", { characterId, itemIds });
      return ok(`Equipped ${itemIds.length} item(s) on character ${characterId}.`, response);
    },
  );

  server.registerTool(
    "transfer_item",
    {
      description:
        "Move an item between a character and the vault. itemReferenceHash is the item's definition hash; itemId is its instance id. Set transferToVault true to push to the vault, false to pull to the character.",
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
