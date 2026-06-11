import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { itemDefinition, itemMeta, itemName, loadoutName, statName, type ItemMeta } from "../bungie/manifest.js";
import {
  ClassType,
  Component,
  DamageType,
  getProfile,
  type DestinyItem,
  type ProfileResponse,
} from "../bungie/profile.js";
import { renderLoadoutCard } from "../format/loadout/index.js";

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
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

async function describePerks(plugHashes: number[]): Promise<{ name: string; description: string }[]> {
  const definitions = await Promise.all(plugHashes.map((hash) => itemDefinition(hash)));

  const seen = new Set<string>();
  const perks: { name: string; description: string }[] = [];
  for (const definition of definitions) {
    const name = definition.displayProperties?.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    perks.push({ name, description: definition.displayProperties?.description ?? "" });
  }
  return perks;
}

async function describeStats(stats: Record<string, { value?: number }>): Promise<Record<string, number>> {
  const entries = await Promise.all(
    Object.entries(stats).map(async ([hash, stat]) => [await statName(Number(hash)), stat.value ?? 0] as const),
  );
  return Object.fromEntries(entries);
}

async function describeItem(itemHash: number, plugHashes: number[], stats: Record<string, { value?: number }>) {
  const definition = await itemDefinition(itemHash);
  const [perks, namedStats] = await Promise.all([describePerks(plugHashes), describeStats(stats)]);
  return {
    name: definition.displayProperties?.name ?? `Item ${itemHash >>> 0}`,
    type: definition.itemTypeDisplayName,
    tier: definition.inventory?.tierTypeName,
    perks,
    stats: namedStats,
  };
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
    "show_loadout",
    {
      description:
        "Render a saved loadout as a visual card with rarity-colored item names and element icons. Defaults to the first character; pass a loadoutIndex (from list_loadouts) to choose a slot.",
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
      if (!loadout) return json({ error: `No loadout at index ${loadoutIndex} for character ${id}` });

      const items = (
        await Promise.all(
          loadout.items
            .filter((item) => hashByInstance.has(item.itemInstanceId))
            .map((item) => itemMeta(hashByInstance.get(item.itemInstanceId)!)),
        )
      ).filter((item): item is ItemMeta => item !== undefined);

      const card = renderLoadoutCard({
        title: (await loadoutName(loadout.nameHash)).toUpperCase(),
        className: ClassType[profile.characters?.data?.[id]?.classType ?? -1] ?? "Unknown",
        slot: loadoutIndex,
        items,
      });
      return text(card);
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

  server.registerTool(
    "inspect_item",
    {
      description:
        "Inspect a single item's mechanics: its perks and mods with current in-game descriptions, named stats, element, tier, and power. Pass an itemInstanceId (from list_inventory / get_equipped) to read the actual rolled perks on that copy — including a subclass's equipped aspects and fragments. Pass an itemHash for an item you don't own (its intrinsic and default perks). This is the source of truth for reasoning about builds and synergies.",
      inputSchema: {
        itemInstanceId: z.string().optional(),
        itemHash: z.number().int().optional(),
      },
    },
    async ({ itemInstanceId, itemHash }) => {
      if (itemInstanceId) {
        const profile = await getProfile([
          Component.Characters,
          Component.CharacterEquipment,
          Component.CharacterInventories,
          Component.ProfileInventories,
          Component.ItemInstances,
          Component.ItemStats,
          Component.ItemSockets,
        ]);

        const hash = instanceMap(profile).get(itemInstanceId);
        if (!hash) throw new Error(`[destiny2-mcp] No item found for instance ${itemInstanceId}.`);

        const instance = profile.itemComponents?.instances?.data?.[itemInstanceId];
        const sockets = profile.itemComponents?.sockets?.data?.[itemInstanceId]?.sockets ?? [];
        const stats = profile.itemComponents?.stats?.data?.[itemInstanceId]?.stats ?? {};
        const plugHashes = sockets
          .filter((socket) => socket.isVisible !== false && socket.plugHash !== undefined)
          .map((socket) => socket.plugHash as number);

        const described = await describeItem(hash, plugHashes, stats);
        return json({
          ...described,
          element: instance?.damageType ? DamageType[instance.damageType] : undefined,
          power: instance?.primaryStat?.value,
        });
      }

      if (itemHash === undefined) {
        throw new Error("[destiny2-mcp] inspect_item requires an itemInstanceId or itemHash.");
      }

      const definition = await itemDefinition(itemHash);
      const plugHashes = (definition.sockets?.socketEntries ?? [])
        .map((entry) => entry.singleInitialItemHash)
        .filter((plugHash): plugHash is number => plugHash !== undefined && plugHash !== 0);

      const described = await describeItem(itemHash, plugHashes, definition.stats?.stats ?? {});
      return json({
        ...described,
        element: definition.defaultDamageType ? DamageType[definition.defaultDamageType] : undefined,
      });
    },
  );
}
