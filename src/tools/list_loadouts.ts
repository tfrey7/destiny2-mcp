import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { itemName, loadoutName } from "../bungie/manifest.js";
import { ClassType, Component, getProfile } from "../bungie/profile.js";
import { instanceMap } from "./inventory.js";
import { json } from "./response.js";

export function registerListLoadouts(server: McpServer): void {
  server.registerTool(
    "list_loadouts",
    {
      description:
        "List the saved in-game loadout slots for each character, including loadout index, name, and the items they hold. Use the loadout index with equip_loadout / snapshot_loadout.",
      inputSchema: {},
    },
    async () => {
      const profile = await getProfile([
        Component.Characters,
        Component.CharacterEquipment,
        Component.CharacterInventories,
        Component.ProfileInventories,
        Component.CharacterLoadouts,
      ]);

      const hashByInstance = instanceMap(profile);
      const loadoutData = profile.characterLoadouts?.data ?? {};

      const result = await Promise.all(
        Object.entries(loadoutData).map(async ([characterId, { loadouts }]) => ({
          characterId,
          class: ClassType[profile.characters?.data?.[characterId]?.classType ?? -1] ?? "Unknown",
          loadouts: await Promise.all(
            loadouts.map(async (loadout, index) => ({
              loadoutIndex: index,
              name: await loadoutName(loadout.nameHash),
              empty: loadout.nameHash === 0 && loadout.items.length === 0,
              items: await Promise.all(
                loadout.items
                  .filter((item) => hashByInstance.has(item.itemInstanceId))
                  .map((item) => itemName(hashByInstance.get(item.itemInstanceId)!)),
              ),
            })),
          ),
        })),
      );

      return json(result);
    },
  );
}
