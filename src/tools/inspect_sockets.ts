import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  itemDefinition,
  itemName,
  socketCategoryName,
  type SocketCategoryEntry,
} from "../bungie/manifest.js";
import { Component, getProfile } from "../bungie/profile.js";
import { availablePlugHashes, mergedPlugSets } from "../bungie/sockets.js";
import { instanceMap } from "./inventory.js";
import { json } from "./response.js";

export function registerInspectSockets(server: McpServer): void {
  server.registerTool(
    "inspect_sockets",
    {
      description:
        "List the sockets on an owned item instance: each socket's index, its category (shader, " +
        "ornament, weapon perk, mod, …), the plug currently inserted, and the plugs the player can " +
        "insert into it. This is how you find the socketIndex and plugItemHash to pass to insert_plug " +
        "when applying a shader or ornament. Pass an itemInstanceId from get_equipped / list_inventory; " +
        "pass a socketIndex to inspect just that socket and get its full (uncapped) list of options.",
      inputSchema: {
        itemInstanceId: z.string(),
        socketIndex: z.number().int().min(0).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ itemInstanceId, socketIndex }) => {
      const profile = await getProfile([
        Component.Characters,
        Component.CharacterEquipment,
        Component.CharacterInventories,
        Component.ProfileInventories,
        Component.ItemSockets,
        Component.ItemReusablePlugs,
      ]);

      const hash = instanceMap(profile).get(itemInstanceId);

      if (!hash) {
        throw new Error(`[destiny2-mcp] No item found for instance ${itemInstanceId}.`);
      }

      const definition = await itemDefinition(hash);
      const entries = definition.sockets?.socketEntries ?? [];
      const categoryHashes = categoryHashByIndex(definition.sockets?.socketCategories ?? []);
      const liveSockets = profile.itemSockets[itemInstanceId]?.sockets ?? [];
      const livePlugs = profile.itemReusablePlugs[itemInstanceId]?.plugs ?? {};
      const plugSets = mergedPlugSets(profile);

      const sockets = (
        await Promise.all(
          liveSockets.map(async (live, index) => {
            if (live.isVisible === false || (socketIndex !== undefined && index !== socketIndex)) {
              return undefined;
            }

            const entry = entries[index];
            const categoryHash = categoryHashes.get(index);
            const currentHash = live.plugHash ?? entry?.singleInitialItemHash;

            // A socket can be visible yet disabled — a fragment slot past the capacity the equipped
            // aspects grant, or a mod socket lacking energy. Nothing can go in until it's enabled, so
            // report no insertable plugs; offering them invites a rejected insert_plug.
            const enabled = live.isEnabled !== false;
            const allHashes = enabled
              ? await availablePlugHashes(index, livePlugs, entry, plugSets)
              : [];
            const cap = socketIndex === undefined ? PLUGS_PER_SOCKET : allHashes.length;
            const available = await Promise.all(allHashes.slice(0, cap).map(plugView));

            return {
              socketIndex: index,
              category: categoryHash ? await socketCategoryName(categoryHash) : undefined,
              current: currentHash ? await plugView(currentHash) : undefined,
              ...(enabled ? {} : { enabled: false }),
              ...(available.length ? { available } : {}),
              ...(allHashes.length > available.length
                ? { moreAvailable: allHashes.length - available.length }
                : {}),
            };
          }),
        )
      ).filter((socket) => socket !== undefined);

      return json({ name: definition.displayProperties?.name, itemInstanceId, sockets });
    },
  );
}

// Cap the candidate plugs reported per socket: account-wide shader/ornament sets run into the
// hundreds. Inspecting a single socketIndex lifts the cap so the full option set is available.
const PLUGS_PER_SOCKET = 16;

function categoryHashByIndex(categories: SocketCategoryEntry[]): Map<number, number> {
  const map = new Map<number, number>();

  for (const category of categories) {
    for (const index of category.socketIndexes) {
      map.set(index, category.socketCategoryHash);
    }
  }

  return map;
}

async function plugView(plugItemHash: number) {
  return { plugItemHash, name: await itemName(plugItemHash) };
}
