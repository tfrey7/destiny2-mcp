import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { itemMeta, loadoutName, type ItemMeta } from "../bungie/manifest.js";
import { ClassType, Component, getProfile } from "../bungie/profile.js";
import { instanceMap } from "./inventory.js";
import { card, json } from "./response.js";

export function registerShowLoadout(server: McpServer): void {
  server.registerTool(
    "show_loadout",
    {
      description:
        "Render a saved loadout as a text card: weapons, armor, and subclass in aligned columns, with exotics marked and elements named. Defaults to the first character; pass a loadoutIndex (from list_loadouts) to choose a slot.",
      inputSchema: { loadoutIndex: z.number(), characterId: z.string().optional() },
    },
    async ({ loadoutIndex, characterId }) => {
      const profile = await getProfile([
        Component.Characters,
        Component.CharacterEquipment,
        Component.CharacterInventories,
        Component.ProfileInventories,
        Component.CharacterLoadouts,
      ]);

      const hashByInstance = instanceMap(profile);
      const loadoutData = profile.characterLoadouts?.data ?? {};
      const id = characterId ?? Object.keys(loadoutData)[0];
      const loadout = loadoutData[id]?.loadouts[loadoutIndex];

      if (!loadout) {
        return json({ error: `No loadout at index ${loadoutIndex} for character ${id}` });
      }

      const items = (
        await Promise.all(
          loadout.items
            .filter((item) => hashByInstance.has(item.itemInstanceId))
            .map((item) => itemMeta(hashByInstance.get(item.itemInstanceId)!)),
        )
      ).filter((item): item is ItemMeta => item !== undefined);

      return card({
        title: (await loadoutName(loadout.nameHash)).toUpperCase(),
        className: ClassType[profile.characters?.data?.[id]?.classType ?? -1] ?? "Unknown",
        slot: loadoutIndex,
        items,
      });
    },
  );
}
