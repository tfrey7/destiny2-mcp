import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { itemName, loadoutName } from "../bungie/manifest.js";
import {
  ClassType,
  Component,
  getProfile,
  type DestinyItem,
  type ProfileResponse,
} from "../bungie/profile.js";

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function instanceMap(profile: ProfileResponse): Map<string, number> {
  const map = new Map<string, number>();
  const add = (items?: DestinyItem[]) => {
    for (const item of items ?? []) {
      if (item.itemInstanceId) map.set(item.itemInstanceId, item.itemHash);
    }
  };

  for (const bucket of Object.values(profile.characterEquipment?.data ?? {})) add(bucket.items);
  for (const bucket of Object.values(profile.characterInventories?.data ?? {})) add(bucket.items);
  add(profile.profileInventory?.data?.items);
  return map;
}

async function namedItems(items: DestinyItem[]): Promise<{ name: string; itemInstanceId?: string; quantity: number }[]> {
  return Promise.all(
    items.map(async (item) => ({
      name: await itemName(item.itemHash),
      itemInstanceId: item.itemInstanceId,
      quantity: item.quantity,
    })),
  );
}

export function registerReadTools(server: McpServer): void {
  server.registerTool(
    "list_characters",
    {
      description: "List the player's Destiny 2 characters with class, power level, and characterId.",
      inputSchema: {},
    },
    async () => {
      const profile = await getProfile([Component.Characters]);
      const characters = Object.values(profile.characters?.data ?? {}).map((character) => ({
        characterId: character.characterId,
        class: ClassType[character.classType] ?? "Unknown",
        light: character.light,
        lastPlayed: character.dateLastPlayed,
      }));
      return json(characters);
    },
  );

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

  server.registerTool(
    "get_equipped",
    {
      description: "List the currently equipped items for each character, by name.",
      inputSchema: { characterId: z.string().optional() },
    },
    async ({ characterId }) => {
      const profile = await getProfile([Component.Characters, Component.CharacterEquipment]);
      const equipment = profile.characterEquipment?.data ?? {};

      const entries = Object.entries(equipment).filter(([id]) => !characterId || id === characterId);
      const result = await Promise.all(
        entries.map(async ([id, bucket]) => ({
          characterId: id,
          class: ClassType[profile.characters?.data?.[id]?.classType ?? -1] ?? "Unknown",
          equipped: await namedItems(bucket.items),
        })),
      );
      return json(result);
    },
  );

  server.registerTool(
    "list_inventory",
    {
      description:
        "List items in character inventories and the vault, by name. Optionally filter to one character or a case-insensitive name search.",
      inputSchema: {
        characterId: z.string().optional(),
        search: z.string().optional(),
      },
    },
    async ({ characterId, search }) => {
      const profile = await getProfile([
        Component.Characters,
        Component.CharacterInventories,
        Component.ProfileInventories,
      ]);

      const term = search?.toLowerCase();
      const filter = (items: { name: string }[]) =>
        term ? items.filter((item) => item.name.toLowerCase().includes(term)) : items;

      const inventories = profile.characterInventories?.data ?? {};
      const characters = await Promise.all(
        Object.entries(inventories)
          .filter(([id]) => !characterId || id === characterId)
          .map(async ([id, bucket]) => ({
            characterId: id,
            class: ClassType[profile.characters?.data?.[id]?.classType ?? -1] ?? "Unknown",
            items: filter(await namedItems(bucket.items)),
          })),
      );

      const vault = filter(await namedItems(profile.profileInventory?.data?.items ?? []));
      return json({ characters, vault });
    },
  );
}
