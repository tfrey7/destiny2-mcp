import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  itemDefinition,
  itemName,
  socketCategoryName,
  type SocketCategoryEntry,
} from "../bungie/manifest.js";
import { Component, getProfile } from "../bungie/profile.js";
import { mergedPlugSets, plugStates } from "../bungie/sockets.js";
import { recommendedPlugHashes } from "./godrolls/logic.js";
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
        "pass a socketIndex to inspect just that socket and get its full (uncapped) list of options. " +
        "Pass includeLocked:true to also return a `locked` array per socket — the plugs the socket's " +
        "full pool contains that the player has NOT unlocked yet. This is the way to answer 'which mods " +
        "am I still missing on this item': the default `available` list is filtered to insertable plugs, " +
        "so locked options are invisible without this flag.",
      inputSchema: {
        itemInstanceId: z.string(),
        socketIndex: z.number().int().min(0).optional(),
        includeLocked: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ itemInstanceId, socketIndex, includeLocked }) => {
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
      const recommended = await recommendedPlugHashes(hash);

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
            const states = enabled ? await plugStates(index, livePlugs, entry, plugSets) : [];
            const cap = socketIndex === undefined ? PLUGS_PER_SOCKET : states.length;

            const unlocked = states.filter((state) => state.unlocked);
            const available = await Promise.all(
              unlocked.slice(0, cap).map((state) => plugView(state.plugItemHash, recommended)),
            );

            const lockedStates = includeLocked ? states.filter((state) => !state.unlocked) : [];
            const locked = await Promise.all(
              lockedStates.slice(0, cap).map((state) => plugView(state.plugItemHash, recommended)),
            );

            return {
              socketIndex: index,
              category: categoryHash ? await socketCategoryName(categoryHash) : undefined,
              current: currentHash ? await plugView(currentHash, recommended) : undefined,
              ...(enabled ? {} : { enabled: false }),
              ...(available.length ? { available } : {}),
              ...(unlocked.length > available.length
                ? { moreAvailable: unlocked.length - available.length }
                : {}),
              ...(locked.length ? { locked } : {}),
              ...(lockedStates.length > locked.length
                ? { moreLocked: lockedStates.length - locked.length }
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

async function plugView(plugItemHash: number, recommended: Set<number>) {
  return {
    plugItemHash,
    name: await itemName(plugItemHash),
    ...(recommended.has(plugItemHash) ? { recommended: true } : {}),
  };
}
