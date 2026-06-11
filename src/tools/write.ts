import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BungieError, bungieFetch } from "../bungie/client.js";
import { itemName } from "../bungie/manifest.js";
import {
  Component,
  getPrimaryMembership,
  getProfile,
  type DestinyItem,
  type ProfileResponse,
} from "../bungie/profile.js";

function ok(message: string, response: unknown) {
  return {
    content: [{ type: "text" as const, text: `${message}\n${JSON.stringify(response, null, 2)}` }],
  };
}

async function action(path: string, body: Record<string, unknown>): Promise<unknown> {
  const { membershipType } = await getPrimaryMembership();
  return bungieFetch(path, { method: "POST", body: { ...body, membershipType } });
}

function transfer(
  characterId: string,
  itemId: string,
  itemReferenceHash: number,
  transferToVault: boolean,
): Promise<unknown> {
  return action("/Destiny2/Actions/Items/TransferItem/", {
    characterId,
    itemId,
    itemReferenceHash,
    transferToVault,
    stackSize: 1,
  });
}

interface Location {
  item: DestinyItem;
  // The character holding the item, or undefined when it sits in the vault.
  characterId?: string;
}

// Find an instanced item anywhere it can live — equipped, in a character's inventory, or the vault —
// so the server can derive its definition hash and current home without the client supplying either.
function locate(profile: ProfileResponse, itemId: string): Location | undefined {
  const find = (items?: DestinyItem[]) => items?.find((item) => item.itemInstanceId === itemId);

  for (const [characterId, bucket] of Object.entries(profile.characterEquipment?.data ?? {})) {
    const item = find(bucket.items);
    if (item) {
      return { item, characterId };
    }
  }
  for (const [characterId, bucket] of Object.entries(profile.characterInventories?.data ?? {})) {
    const item = find(bucket.items);
    if (item) {
      return { item, characterId };
    }
  }
  const vaultItem = find(profile.profileInventory?.data?.items);
  return vaultItem ? { item: vaultItem } : undefined;
}

// A non-equipped copy of the same item already sitting in the character's inventory. Copies share a
// definition hash and therefore a bucket, so one of these is exactly what occupies a full destination.
function inventoryDuplicate(
  profile: ProfileResponse,
  characterId: string,
  itemHash: number,
  excludeItemId: string,
): DestinyItem | undefined {
  const items = profile.characterInventories?.data?.[characterId]?.items ?? [];
  return items.find((item) => item.itemHash === itemHash && item.itemInstanceId !== excludeItemId);
}

// Bring an instanced item onto a character so it can be equipped, returning a note describing any
// transfer performed (empty when the item was already there). Pulls from the vault unconditionally;
// when the destination bucket is full it only evicts a *duplicate of the same item*, matching the
// hand-orchestrated policy — anything else fails clearly so the caller decides what to drop.
async function ensureOnCharacter(
  profile: ProfileResponse,
  characterId: string,
  itemId: string,
): Promise<string> {
  const location = locate(profile, itemId);
  if (!location) {
    throw new Error(
      `[destiny2-mcp] No item with instance id ${itemId} found in any inventory, equipment, or the vault.`,
    );
  }

  if (location.characterId === characterId) {
    return "";
  }

  const itemHash = location.item.itemHash;
  const name = await itemName(itemHash);

  // On another character: the API only transfers character↔vault, so push it to the vault first.
  if (location.characterId) {
    await transfer(location.characterId, itemId, itemHash, true);
  }

  try {
    await transfer(characterId, itemId, itemHash, false);
    return `Pulled ${name} to the character. `;
  } catch (error) {
    if (!(error instanceof BungieError) || error.errorStatus !== "DestinyNoRoomInDestination") {
      throw error;
    }

    const duplicate = inventoryDuplicate(profile, characterId, itemHash, itemId);
    if (!duplicate?.itemInstanceId) {
      throw new Error(
        `[destiny2-mcp] The destination bucket for ${name} is full and holds no duplicate to evict. ` +
          `Pass an item to move to the vault first, then retry the equip.`,
      );
    }

    await transfer(characterId, duplicate.itemInstanceId, itemHash, true);
    await transfer(characterId, itemId, itemHash, false);
    return `Pulled ${name} to the character, evicting a duplicate to the vault for room. `;
  }
}

const TRANSFER_COMPONENTS = [
  Component.CharacterEquipment,
  Component.CharacterInventories,
  Component.ProfileInventories,
];

export function registerWriteTools(server: McpServer): void {
  server.registerTool(
    "equip_loadout",
    {
      description:
        "Equip one of a character's saved in-game loadout slots. Find the loadoutIndex via list_loadouts.",
      inputSchema: {
        characterId: z.string(),
        loadoutIndex: z.number().int().min(0),
      },
    },
    async ({ characterId, loadoutIndex }) => {
      const response = await action("/Destiny2/Actions/Loadouts/EquipLoadout/", {
        characterId,
        loadoutIndex,
      });
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
      const response = await action("/Destiny2/Actions/Loadouts/SnapshotLoadout/", {
        characterId,
        loadoutIndex,
      });
      return ok(
        `Snapshotted current gear into loadout ${loadoutIndex} on character ${characterId}.`,
        response,
      );
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
      return ok(
        `Updated identifiers for loadout ${loadoutIndex} on character ${characterId}.`,
        response,
      );
    },
  );

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
