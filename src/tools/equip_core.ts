import { BungieError } from "../bungie/client.js";
import { itemMeta } from "../bungie/manifest.js";
import { action, ensureOnCharacter, itemHashFor, type LocatableProfile } from "./actions.js";

// Bungie's PlatformErrorCodes.DestinyCannotPerformActionAtThisLocation — the player isn't signed into
// Destiny 2, so the equip can't run. Transfers and plug inserts work offline, but equips don't, so
// callers surface this as "go in-game", not a tool bug.
export const NOT_IN_GAME = 1623;

// The outcome of equipping a set of gear: a per-item verdict (so a single piece can fail without
// sinking the rest), the transfer notes accrued pulling pieces onto the character, and whether any
// failure was the player being out of the game.
export interface EquipGearOutcome {
  results: GearEquipResult[];
  notes: string;
  liveActionRequired: boolean;
}

export interface GearEquipResult {
  itemId: string;
  name: string;
  status: "equipped" | "failed";
  reason?: string;
}

// Move every piece onto the character, then equip them in one batched call with exotics last. This is
// the shared engine behind equip_items and equip_build: resilient (a transfer or equip that fails
// drops only that piece) and self-reporting (each item gets an equipped/failed verdict by name).
//
// Bungie throttles concurrent item actions, so transfers run sequentially — a parallel burst draws
// ThrottleLimitExceeded rather than finishing faster. Exotics equip last so trading one exotic for
// another doesn't trip the one-exotic limit mid-swap: EquipItems applies its array in order, and a
// non-exotic taking the outgoing exotic's slot first clears the way for the incoming one.
export async function equipGear(
  profile: LocatableProfile,
  characterId: string,
  itemIds: string[],
): Promise<EquipGearOutcome> {
  // Resolve each item up front: its name (for the result) and rarity (to order exotics last).
  const items = await Promise.all(
    itemIds.map(async (itemId) => {
      const hash = itemHashFor(profile, itemId);
      const meta = hash === undefined ? undefined : await itemMeta(hash);

      return { itemId, name: meta?.name ?? itemId, exotic: meta?.rarity === "Exotic" };
    }),
  );

  // Pull each piece onto the character one at a time. A transfer that fails (item missing, bucket full
  // of distinct items) drops just that piece — the rest still equip — and is reported by name.
  const transferFailures = new Map<string, string>();
  let notes = "";

  for (const { itemId } of items) {
    try {
      notes += await ensureOnCharacter(profile, characterId, itemId);
    } catch (error) {
      transferFailures.set(itemId, actionReason(error));
    }
  }

  const equipable = items.filter((item) => !transferFailures.has(item.itemId));
  // Stable sort keeps slot order within each rarity tier; exotics (1) sort after non-exotics (0).
  const ordered = [...equipable].sort((a, b) => Number(a.exotic) - Number(b.exotic));

  let liveActionRequired = false;
  let batchReason: string | undefined;
  let statusByItem = new Map<string, number>();

  if (ordered.length) {
    try {
      const response = (await action("/Destiny2/Actions/Items/EquipItems/", {
        characterId,
        itemIds: ordered.map((item) => item.itemId),
      })) as EquipItemsResponse;

      // EquipItems reports a per-item status even when the overall call "succeeds", so a single piece
      // can silently fail to equip. Absence of an entry means it equipped.
      statusByItem = new Map(
        (response.equipResults ?? []).map((result) => [result.itemInstanceId, result.equipStatus]),
      );
    } catch (error) {
      // The whole batch threw (commonly 1623 when out of the game): no piece equipped.
      batchReason = actionReason(error);
      liveActionRequired = isNotInGame(error);
    }
  }

  const results = items.map(({ itemId, name }): GearEquipResult => {
    const transferReason = transferFailures.get(itemId);

    if (transferReason) {
      return { itemId, name, status: "failed", reason: transferReason };
    }

    if (batchReason) {
      return { itemId, name, status: "failed", reason: batchReason };
    }

    const status = statusByItem.get(itemId);

    if (status !== undefined && status !== EQUIP_SUCCESS) {
      liveActionRequired ||= status === NOT_IN_GAME;

      return { itemId, name, status: "failed", reason: equipStatusReason(status) };
    }

    return { itemId, name, status: "equipped" };
  });

  return { results, notes, liveActionRequired };
}

// A short, human reason for a failed item action. Bungie errors carry a descriptive status name
// (DestinyNoRoomInDestination, DestinyCannotPerformActionAtThisLocation); other errors fall back to
// their message with the server's log prefix stripped.
export function actionReason(error: unknown): string {
  if (error instanceof BungieError) {
    return error.errorStatus;
  }

  if (error instanceof Error) {
    return error.message.replace(/^\[destiny2-mcp\]\s*/, "");
  }

  return String(error);
}

export function isNotInGame(error: unknown): boolean {
  return error instanceof BungieError && error.errorCode === NOT_IN_GAME;
}

// Bungie's PlatformErrorCodes.Success — an equipResults entry with any other status didn't equip.
const EQUIP_SUCCESS = 1;

function equipStatusReason(status: number): string {
  return status === NOT_IN_GAME
    ? "not signed into Destiny 2 (equipping needs you in-game)"
    : `Bungie equip status ${status}`;
}

interface EquipItemsResponse {
  equipResults?: { itemInstanceId: string; equipStatus: number }[];
}
