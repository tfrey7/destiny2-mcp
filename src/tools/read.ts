import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { acquisitionFor, ownedCollectibles } from "../bungie/acquisition.js";
import {
  ammoTypeLabel,
  findItemByName,
  itemDefinition,
  itemMeta,
  itemName,
  loadoutName,
  searchItems,
  slotFromBucketHash,
  statName,
  type ItemMeta,
} from "../bungie/manifest.js";
import {
  ClassType,
  Component,
  DamageType,
  getProfile,
  type DestinyItem,
  type ProfileResponse,
} from "../bungie/profile.js";
import { renderLoadoutCardPng, type LoadoutCard } from "../format/loadout/index.js";

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

/** Render a loadout card to a PNG image block — the visual artifact shows inline instead of collapsing. */
function card(spec: LoadoutCard) {
  const png = renderLoadoutCardPng(spec);
  return {
    content: [{ type: "image" as const, data: png.toString("base64"), mimeType: "image/png" }],
  };
}

function instanceMap(profile: ProfileResponse): Map<string, number> {
  const map = new Map<string, number>();
  const add = (items?: DestinyItem[]) => {
    for (const item of items ?? []) {
      if (item.itemInstanceId) {
        map.set(item.itemInstanceId, item.itemHash);
      }
    }
  };

  for (const bucket of Object.values(profile.characterEquipment?.data ?? {})) {
    add(bucket.items);
  }
  for (const bucket of Object.values(profile.characterInventories?.data ?? {})) {
    add(bucket.items);
  }
  add(profile.profileInventory?.data?.items);
  return map;
}

async function namedItems(
  items: DestinyItem[],
): Promise<{ name: string; itemInstanceId?: string; quantity: number; slot?: string }[]> {
  return Promise.all(
    items.map(async (item) => {
      const meta = await itemMeta(item.itemHash);
      return {
        name: meta?.name ?? (await itemName(item.itemHash)),
        itemInstanceId: item.itemInstanceId,
        quantity: item.quantity,
        // Only weapons resolve to a slot; armor and consumables leave it undefined (omitted from JSON).
        slot: slotFromBucketHash(meta?.bucketHash),
      };
    }),
  );
}

interface InventoryItem {
  name: string;
  itemInstanceId?: string;
  quantity: number;
  slot?: string;
  element?: string;
  type?: string;
  tier?: string;
}

// Like namedItems, but carries the manifest attributes (element/type/tier) that list_inventory filters
// and projects on. All come from the item definition, so no per-instance profile components are needed.
async function inventoryItems(items: DestinyItem[]): Promise<InventoryItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const meta = await itemMeta(item.itemHash);
      return {
        name: meta?.name ?? (await itemName(item.itemHash)),
        itemInstanceId: item.itemInstanceId,
        quantity: item.quantity,
        slot: slotFromBucketHash(meta?.bucketHash),
        element: meta?.element,
        type: meta?.type || undefined,
        // "Basic" is the manifest default for unranked junk; drop it so the field stays signal.
        tier: meta?.rarity && meta.rarity !== "Basic" ? meta.rarity : undefined,
      };
    }),
  );
}

async function describePerks(
  plugHashes: number[],
): Promise<{ name: string; description: string }[]> {
  const definitions = await Promise.all(plugHashes.map((hash) => itemDefinition(hash)));

  const seen = new Set<string>();
  const perks: { name: string; description: string }[] = [];
  for (const definition of definitions) {
    const name = definition.displayProperties?.name;
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    perks.push({ name, description: definition.displayProperties?.description ?? "" });
  }
  return perks;
}

async function describeStats(
  stats: Record<string, { value?: number }>,
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    Object.entries(stats).map(
      async ([hash, stat]) => [await statName(Number(hash)), stat.value ?? 0] as const,
    ),
  );
  return Object.fromEntries(entries);
}

async function describeItem(
  itemHash: number,
  plugHashes: number[],
  stats: Record<string, { value?: number }>,
) {
  const definition = await itemDefinition(itemHash);
  const [perks, namedStats] = await Promise.all([describePerks(plugHashes), describeStats(stats)]);
  return {
    name: definition.displayProperties?.name ?? `Item ${itemHash >>> 0}`,
    type: definition.itemTypeDisplayName,
    tier: definition.inventory?.tierTypeName,
    slot: slotFromBucketHash(definition.inventory?.bucketTypeHash),
    ammoType: ammoTypeLabel(definition.equippingBlock?.ammoType),
    perks,
    stats: namedStats,
  };
}

export function registerReadTools(server: McpServer): void {
  server.registerTool(
    "list_characters",
    {
      description:
        "List the player's Destiny 2 characters with class, power level, and characterId.",
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

  server.registerTool(
    "get_equipped",
    {
      description: "List the currently equipped items for each character, by name.",
      inputSchema: { characterId: z.string().optional() },
    },
    async ({ characterId }) => {
      const profile = await getProfile([Component.Characters, Component.CharacterEquipment]);
      const equipment = profile.characterEquipment?.data ?? {};

      const entries = Object.entries(equipment).filter(
        ([id]) => !characterId || id === characterId,
      );
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
    "show_equipped",
    {
      description:
        "Render the currently equipped gear as a visual card with rarity-colored item names and element icons. Defaults to the most recently played character; pass a characterId to choose another. Use this to show a player their current loadout.",
      inputSchema: { characterId: z.string().optional() },
    },
    async ({ characterId }) => {
      const profile = await getProfile([Component.Characters, Component.CharacterEquipment]);
      const equipment = profile.characterEquipment?.data ?? {};

      const id =
        characterId ??
        Object.values(profile.characters?.data ?? {}).sort((a, b) =>
          (b.dateLastPlayed ?? "").localeCompare(a.dateLastPlayed ?? ""),
        )[0]?.characterId ??
        Object.keys(equipment)[0];
      const bucket = id ? equipment[id] : undefined;
      if (!bucket) {
        return json({ error: `No equipped gear for character ${id}` });
      }

      const items = (await Promise.all(bucket.items.map((item) => itemMeta(item.itemHash)))).filter(
        (item): item is ItemMeta => item !== undefined,
      );

      return card({
        title: "EQUIPPED",
        className: ClassType[profile.characters?.data?.[id]?.classType ?? -1] ?? "Unknown",
        subtitle: "current",
        items,
      });
    },
  );

  server.registerTool(
    "list_inventory",
    {
      description:
        "List items in character inventories and the vault. Filter by any combination of character, case-insensitive name search, element, item type (e.g. 'Auto Rifle'), and tier. Each item also reports its element, type, and tier so results can be refined without inspect_item. The full inventory is large: narrow with filters, or pass summary:true to get counts by element/type/slot/tier instead of the item list. Results are capped at `limit` (default 200) with a `truncated` flag.",
      inputSchema: {
        characterId: z.string().optional(),
        search: z.string().optional(),
        element: z
          .enum(["Kinetic", "Arc", "Solar", "Void", "Stasis", "Strand", "Prismatic"])
          .optional(),
        type: z.string().optional(),
        tier: z.enum(["Exotic", "Legendary", "Rare", "Uncommon", "Common"]).optional(),
        summary: z.boolean().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      },
    },
    async ({ characterId, search, element, type, tier, summary, limit }) => {
      const profile = await getProfile([
        Component.Characters,
        Component.CharacterInventories,
        Component.ProfileInventories,
      ]);

      const term = search?.toLowerCase();
      const typeTerm = type?.toLowerCase();
      const matches = (item: InventoryItem) =>
        (!term || item.name.toLowerCase().includes(term)) &&
        (!element || item.element === element) &&
        (!typeTerm || (item.type ?? "").toLowerCase().includes(typeTerm)) &&
        (!tier || item.tier === tier);

      const inventories = profile.characterInventories?.data ?? {};
      const charGroups = await Promise.all(
        Object.entries(inventories)
          .filter(([id]) => !characterId || id === characterId)
          .map(async ([id, bucket]) => ({
            characterId: id,
            class: ClassType[profile.characters?.data?.[id]?.classType ?? -1] ?? "Unknown",
            items: (await inventoryItems(bucket.items)).filter(matches),
          })),
      );
      const vaultItems = (await inventoryItems(profile.profileInventory?.data?.items ?? [])).filter(
        matches,
      );

      if (summary) {
        const all = [...charGroups.flatMap((group) => group.items), ...vaultItems];
        const tally = (key: keyof InventoryItem) => {
          const counts: Record<string, number> = {};
          for (const item of all) {
            const value = item[key];
            if (typeof value === "string") {
              counts[value] = (counts[value] ?? 0) + 1;
            }
          }
          return counts;
        };
        return json({
          total: all.length,
          byElement: tally("element"),
          byType: tally("type"),
          bySlot: tally("slot"),
          byTier: tally("tier"),
        });
      }

      const cap = limit ?? 200;
      const total =
        charGroups.reduce((sum, group) => sum + group.items.length, 0) + vaultItems.length;
      let budget = cap;
      const take = (items: InventoryItem[]) => {
        const slice = items.slice(0, Math.max(0, budget));
        budget -= slice.length;
        return slice;
      };

      const characters = charGroups.map((group) => ({ ...group, items: take(group.items) }));
      const vault = take(vaultItems);
      return json({
        total,
        truncated: total > cap,
        ...(total > cap
          ? { note: `Showing ${cap} of ${total} items. Narrow with filters or use summary:true.` }
          : {}),
        characters,
        vault,
      });
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
        if (!hash) {
          throw new Error(`[destiny2-mcp] No item found for instance ${itemInstanceId}.`);
        }

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
        element: definition.defaultDamageType
          ? DamageType[definition.defaultDamageType]
          : undefined,
      });
    },
  );

  server.registerTool(
    "how_to_acquire",
    {
      description:
        "Look up how to acquire weapons or armor by name: the in-game source (activity, vendor, etc.), rarity, item type, and whether the account already owns it. Use this to tell the player where to find gear they are missing for a build.",
      inputSchema: { items: z.array(z.string()).min(1) },
    },
    async ({ items }) => {
      const owned = await ownedCollectibles();
      const result = await Promise.all(
        items.map(async (name) => {
          const hash = await findItemByName(name);
          if (hash === undefined) {
            return { name, note: "No item with this exact name in the manifest." };
          }
          return acquisitionFor(hash, owned);
        }),
      );
      return json(result);
    },
  );

  server.registerTool(
    "search_items",
    {
      description:
        "Search the full Destiny 2 item catalog (the manifest, not the player's inventory) by attribute. Filter by any combination of name substring, element, item type (e.g. 'Trace Rifle'), tier, and category. Use this to enumerate gear that matches criteria — e.g. every exotic Strand weapon — rather than answering from memory. Each result's name and itemHash feed how_to_acquire and inspect_item.",
      inputSchema: {
        name: z.string().optional(),
        element: z
          .enum(["Kinetic", "Arc", "Solar", "Void", "Stasis", "Strand", "Prismatic"])
          .optional(),
        type: z.string().optional(),
        tier: z.enum(["Exotic", "Legendary", "Rare", "Uncommon", "Common"]).optional(),
        category: z.enum(["weapon", "armor"]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async (filters) => {
      const { count, truncated, items } = await searchItems(filters);
      const result = items.map((item) => ({
        name: item.name,
        tier: item.tier,
        type: item.type,
        element: item.element,
        slot: item.slot,
        ammoType: item.ammoType,
        itemHash: item.hash,
      }));
      return json({ count, truncated, items: result });
    },
  );
}
