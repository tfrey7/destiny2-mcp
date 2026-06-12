import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { acquisitionFor, ownedCollectibles } from "../bungie/acquisition.js";
import {
  ammoTypeLabel,
  artifactName,
  artifactPerkText,
  findItemByName,
  itemDefinition,
  itemMeta,
  itemName,
  loadoutName,
  plugSetItemHashes,
  searchItems,
  slotFromBucketHash,
  socketCategoryName,
  statName,
  type ItemMeta,
  type SocketCategoryEntry,
  type SocketEntry,
} from "../bungie/manifest.js";
import {
  ClassType,
  Component,
  DamageType,
  getProfile,
  type DestinyItem,
  type ProfileResponse,
  type ReusablePlug,
  type SeasonalArtifact,
} from "../bungie/profile.js";
import { renderArtifactCardText, type ArtifactView } from "../format/artifact.js";
import { renderLoadoutCardText, type LoadoutCard } from "../format/loadout/index.js";

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function card(spec: LoadoutCard) {
  return { content: [{ type: "text" as const, text: renderLoadoutCardText(spec) }] };
}

function artifactCard(view: ArtifactView) {
  return { content: [{ type: "text" as const, text: renderArtifactCardText(view) }] };
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

interface InventoryItem {
  name: string;
  itemInstanceId?: string;
  quantity: number;
  slot?: string;
  element?: string;
  type?: string;
  tier?: string;
}

// Carries the manifest attributes (element/type/tier) that list_inventory filters and projects on,
// and that get_equipped reports. All come from the item definition, so no per-instance components needed.
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

// The artifact is account-wide, so its unlock state is identical on every character; read the first.
function seasonalArtifact(profile: ProfileResponse): SeasonalArtifact | undefined {
  for (const character of Object.values(profile.characterProgressions?.data ?? {})) {
    if (character.seasonalArtifact) {
      return character.seasonalArtifact;
    }
  }
  return undefined;
}

async function describeArtifact(artifact: SeasonalArtifact) {
  const tiers = await Promise.all(
    artifact.tiers.map(async (tier, index) => ({
      tier: index + 1,
      unlocked: tier.isUnlocked,
      perks: await Promise.all(
        tier.items
          .filter((perk) => perk.isVisible !== false)
          .map(async (perk) => {
            const { name, description } = await artifactPerkText(perk.itemHash);

            return { name, description, active: perk.isActive };
          }),
      ),
    })),
  );

  return {
    name: await artifactName(artifact.artifactHash),
    pointsUsed: artifact.pointsUsed,
    resetCount: artifact.resetCount,
    tiers,
  };
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

// Account-wide unlocks (shaders, universal ornaments) live in the profile/character plug-set
// components, keyed by plug-set hash, not on the item instance. These ride along with ItemSockets.
function mergedPlugSets(profile: ProfileResponse): Map<number, ReusablePlug[]> {
  const sets = new Map<number, ReusablePlug[]>();
  const add = (plugs?: Record<string, ReusablePlug[]>) => {
    for (const [hash, list] of Object.entries(plugs ?? {})) {
      sets.set(Number(hash), list);
    }
  };

  add(profile.profilePlugSets?.data?.plugs);
  for (const character of Object.values(profile.characterPlugSets?.data ?? {})) {
    add(character.plugs);
  }
  return sets;
}

// Resolve the plugs the player can actually insert. Random-roll perk sockets are per-instance, so
// the live component is authoritative; reusable cosmetic sockets pull their full unlocked set from
// the account-wide plug-set components — the live component only reports a partial instance subset.
async function availablePlugHashes(
  socketIndex: number,
  livePlugs: Record<string, ReusablePlug[]>,
  entry: SocketEntry | undefined,
  plugSets: Map<number, ReusablePlug[]>,
): Promise<number[]> {
  const live = livePlugs[String(socketIndex)];

  if (entry?.randomizedPlugSetHash !== undefined && live?.length) {
    return live.filter((plug) => plug.canInsert !== false).map((plug) => plug.plugItemHash);
  }
  if (entry?.reusablePlugSetHash !== undefined) {
    const set = plugSets.get(entry.reusablePlugSetHash);

    if (set?.length) {
      return set.filter((plug) => plug.canInsert).map((plug) => plug.plugItemHash);
    }
  }
  if (live?.length) {
    return live.filter((plug) => plug.canInsert !== false).map((plug) => plug.plugItemHash);
  }
  if (entry?.reusablePlugItems?.length) {
    return entry.reusablePlugItems.map((plug) => plug.plugItemHash);
  }
  if (entry?.reusablePlugSetHash !== undefined) {
    return plugSetItemHashes(entry.reusablePlugSetHash);
  }
  return [];
}

async function plugView(plugItemHash: number) {
  return { plugItemHash, name: await itemName(plugItemHash) };
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

  server.registerTool(
    "get_equipped",
    {
      description:
        "List the currently equipped items for each character. Each item reports its slot, element, type, and tier, so element matching and the one-exotic-weapon limit can be reasoned about directly — no follow-up inspect_item needed for those attributes.",
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
          equipped: await inventoryItems(bucket.items),
        })),
      );

      return json(result);
    },
  );

  server.registerTool(
    "show_equipped",
    {
      description:
        "Render the currently equipped gear as a text card: weapons, armor, and subclass in aligned columns, with exotics marked and elements named. Defaults to the most recently played character; pass a characterId to choose another. Use this to show a player their current loadout.",
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
      const liveSockets = profile.itemComponents?.sockets?.data?.[itemInstanceId]?.sockets ?? [];
      const livePlugs = profile.itemComponents?.reusablePlugs?.data?.[itemInstanceId]?.plugs ?? {};
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
            const allHashes = await availablePlugHashes(index, livePlugs, entry, plugSets);
            const cap = socketIndex === undefined ? PLUGS_PER_SOCKET : allHashes.length;
            const available = await Promise.all(allHashes.slice(0, cap).map(plugView));

            return {
              socketIndex: index,
              category: categoryHash ? await socketCategoryName(categoryHash) : undefined,
              current: currentHash ? await plugView(currentHash) : undefined,
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
        "Search the full Destiny 2 item catalog (the manifest, not the player's inventory) by attribute. Filter by any combination of name substring, element, item type (e.g. 'Trace Rifle'), tier, and category. Use this to enumerate gear that matches criteria — e.g. every exotic Strand weapon, or every shader matching a theme — rather than answering from memory. The cosmetic categories (shader, emblem, ornament, or cosmetic for all three) surface looks a player can apply; each result's itemHash is the plugItemHash for insert_plug (shaders/ornaments) or feeds how_to_acquire and inspect_item.",
      inputSchema: {
        name: z.string().optional(),
        element: z
          .enum(["Kinetic", "Arc", "Solar", "Void", "Stasis", "Strand", "Prismatic"])
          .optional(),
        type: z.string().optional(),
        tier: z.enum(["Exotic", "Legendary", "Rare", "Uncommon", "Common"]).optional(),
        category: z
          .enum(["weapon", "armor", "shader", "emblem", "ornament", "cosmetic"])
          .optional(),
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

  server.registerTool(
    "get_artifact",
    {
      description:
        "Report the player's active seasonal artifact: its name, points spent, and every perk grouped by tier — each marked as chosen or not — with current in-game descriptions. This is the source of truth for which artifact perks (anti-champion mods and build bonuses) are currently active. Read-only: the artifact and its perks are chosen in-game and can't be set through the API.",
      inputSchema: {},
    },
    async () => {
      const profile = await getProfile([Component.CharacterProgressions]);
      const artifact = seasonalArtifact(profile);

      if (!artifact) {
        return json({ error: "No seasonal artifact found on this account." });
      }
      return json(await describeArtifact(artifact));
    },
  );

  server.registerTool(
    "show_artifact",
    {
      description:
        "Render the player's active seasonal artifact as a text card: each tier's perks listed with the chosen ones marked ●. Use this to show a player their artifact at a glance; pair with get_artifact for the perk descriptions.",
      inputSchema: {},
    },
    async () => {
      const profile = await getProfile([Component.CharacterProgressions]);
      const artifact = seasonalArtifact(profile);

      if (!artifact) {
        return json({ error: "No seasonal artifact found on this account." });
      }
      return artifactCard(await describeArtifact(artifact));
    },
  );
}
