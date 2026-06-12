import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ammoTypeLabel,
  equipableItemSet,
  gearTierFromPlugs,
  itemDefinition,
  plugDescription,
  slotFromBucketHash,
  statName,
} from "../bungie/manifest.js";
import { Component, DamageType, getProfile } from "../bungie/profile.js";
import { instanceMap } from "./inventory.js";
import { json } from "./response.js";

export function registerInspectItem(server: McpServer): void {
  server.registerTool(
    "inspect_item",
    {
      description:
        "Inspect a single item's mechanics: its perks and mods with current in-game descriptions, named stats, element, rarity tier, power, gear tier (the 1-5 Edge of Fate quality scale, armor only — only resolved for an owned instance), and armor set with its set-bonus perks. Pass an itemInstanceId (from list_inventory / get_equipped) to read the actual rolled perks on that copy — including a subclass's equipped aspects and fragments. Pass an itemHash for an item you don't own (its intrinsic and default perks). For a perk, trait, or mod itemHash (resolve one by name with search_items category:perk), this returns that plug's own description — what the perk actually does. This is the source of truth for reasoning about builds and synergies.",
      inputSchema: {
        itemInstanceId: z.string().optional(),
        itemHash: z.number().int().optional(),
      },
      annotations: { readOnlyHint: true },
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
          .filter(
            (socket) =>
              socket.isVisible !== false &&
              socket.isEnabled !== false &&
              socket.plugHash !== undefined,
          )
          .map((socket) => socket.plugHash as number);

        const [described, gearTier] = await Promise.all([
          describeItem(hash, plugHashes, stats),
          gearTierFromPlugs(plugHashes),
        ]);

        return json({
          ...described,
          element: instance?.damageType ? DamageType[instance.damageType] : undefined,
          power: instance?.primaryStat?.value,
          gearTier,
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
}

async function describePerks(
  plugHashes: number[],
): Promise<{ name: string; description: string }[]> {
  const definitions = await Promise.all(plugHashes.map((hash) => itemDefinition(hash)));
  const described = await Promise.all(
    definitions.map(async (definition) => ({
      name: definition.displayProperties?.name,
      description: await plugDescription(definition),
    })),
  );

  const seen = new Set<string>();
  const perks: { name: string; description: string }[] = [];

  for (const { name, description } of described) {
    if (!name || seen.has(name)) {
      continue;
    }

    seen.add(name);
    perks.push({ name, description });
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
  const setHash = definition.equippingBlock?.equipableItemSetHash;
  const [perks, namedStats, set] = await Promise.all([
    describePerks(plugHashes),
    describeStats(stats),
    setHash ? equipableItemSet(setHash) : undefined,
  ]);

  return {
    name: definition.displayProperties?.name ?? `Item ${itemHash >>> 0}`,
    type: definition.itemTypeDisplayName,
    tier: definition.inventory?.tierTypeName,
    slot: slotFromBucketHash(definition.inventory?.bucketTypeHash),
    ammoType: ammoTypeLabel(definition.equippingBlock?.ammoType),
    // For a plug (a perk, trait, or mod) the item's own description IS the mechanic; surface it —
    // following the sandbox-perk link for aspects/fragments, whose own description is blank. Gear has
    // only flavor text here, which the per-socket `perks` already cover, so leave it off.
    description: definition.plug ? await plugDescription(definition) : undefined,
    set,
    perks,
    stats: namedStats,
  };
}
