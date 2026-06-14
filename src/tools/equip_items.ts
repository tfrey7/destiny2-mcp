import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { itemMeta } from "../bungie/manifest.js";
import { getProfile } from "../bungie/profile.js";
import { action, ensureOnCharacter, itemHashFor, TRANSFER_COMPONENTS } from "./actions.js";
import { ok } from "./response.js";

export function registerEquipItems(server: McpServer): void {
  server.registerTool(
    "equip_items",
    {
      description:
        "Equip several items on a character at once by their item instance ids — the whole loadout in one " +
        "call. Each item is moved onto the character automatically if it sits in the vault or on another " +
        "character, so no transfer_item calls are needed first. Exotics are equipped last so trading one " +
        "exotic for another doesn't trip the one-exotic limit mid-swap, and any piece Bungie declines to " +
        "equip is reported by name. A full destination bucket is cleared by bumping a duplicate of the " +
        "same item to the vault; otherwise the equip fails asking you to name an item to move.",
      inputSchema: {
        characterId: z.string(),
        itemIds: z.array(z.string()).min(1),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ characterId, itemIds }) => {
      const profile = await getProfile(TRANSFER_COMPONENTS);

      // Resolve each item up front: its name (for the result) and rarity (to order exotics last).
      const items = await Promise.all(
        itemIds.map(async (itemId) => {
          const hash = itemHashFor(profile, itemId);
          const meta = hash === undefined ? undefined : await itemMeta(hash);

          return { itemId, name: meta?.name ?? itemId, exotic: meta?.rarity === "Exotic" };
        }),
      );

      // Pull each piece onto the character one at a time. Bungie throttles concurrent item actions, so a
      // parallel burst draws ThrottleLimitExceeded rather than finishing faster (same as vault_inventory).
      let notes = "";

      for (const { itemId } of items) {
        notes += await ensureOnCharacter(profile, characterId, itemId);
      }

      // Equip exotics last. EquipItems applies the array in order, and equipping a second exotic of a
      // category while the first is still worn is rejected; putting the non-exotics first clears the
      // outgoing exotic from its slot so the incoming one lands cleanly. Stable sort keeps slot order.
      const ordered = [...items].sort((a, b) => Number(a.exotic) - Number(b.exotic));

      const response = (await action("/Destiny2/Actions/Items/EquipItems/", {
        characterId,
        itemIds: ordered.map((item) => item.itemId),
      })) as EquipItemsResponse;

      // EquipItems reports a per-item status even when the overall call "succeeds", so a single piece can
      // silently fail to equip. Surface those by name rather than claiming the whole loadout went on.
      const nameFor = new Map(items.map((item) => [item.itemId, item.name]));
      const failed = (response.equipResults ?? []).filter(
        (result) => result.equipStatus !== SUCCESS,
      );

      const message = failed.length
        ? `${notes}Equipped ${itemIds.length - failed.length} of ${itemIds.length} item(s) on character ` +
          `${characterId}. These did not equip: ` +
          failed
            .map(
              (result) =>
                `${nameFor.get(result.itemInstanceId) ?? result.itemInstanceId} ` +
                `(Bungie equip status ${result.equipStatus})`,
            )
            .join(", ") +
          "."
        : `${notes}Equipped ${itemIds.length} item(s) on character ${characterId}.`;

      return ok(message, response);
    },
  );
}

// Bungie's PlatformErrorCodes.Success — an equipResults entry with any other status didn't equip.
const SUCCESS = 1;

interface EquipItemsResponse {
  equipResults?: { itemInstanceId: string; equipStatus: number }[];
}
