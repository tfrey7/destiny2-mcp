import { BungieError, bungieFetch } from "../bungie/client.js";
import { itemName } from "../bungie/manifest.js";
import {
  Component,
  getPrimaryMembership,
  type DestinyItem,
  type ProfileResponse,
} from "../bungie/profile.js";

export const TRANSFER_COMPONENTS = [
  Component.CharacterEquipment,
  Component.CharacterInventories,
  Component.ProfileInventories,
];

export async function action(path: string, body: Record<string, unknown>): Promise<unknown> {
  const { membershipType } = await getPrimaryMembership();

  return bungieFetch(path, { method: "POST", body: { ...body, membershipType } });
}

export function transfer(
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

// Bring an instanced item onto a character so it can be equipped, returning a note describing any
// transfer performed (empty when the item was already there). Pulls from the vault unconditionally;
// when the destination bucket is full it only evicts a *duplicate of the same item*, matching the
// hand-orchestrated policy — anything else fails clearly so the caller decides what to drop.
export async function ensureOnCharacter(
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
