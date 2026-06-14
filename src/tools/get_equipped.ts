import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { describePlugs, equipableItemSet, intrinsicPerks, itemMeta } from "../bungie/manifest.js";
import { ClassType, type DestinyItem, getEquippedProfile } from "../bungie/profile.js";
import { inventoryItems, socketPlugsByInstance } from "./inventory.js";
import { json } from "./response.js";

// DestinyItemType.Subclass — the equipped subclass occupies its own slot; its sockets hold the super,
// abilities, aspects, and fragments that define which verbs the build generates and amplifies.
const SUBCLASS_ITEM_TYPE = 16;

// The subclass a character is running, with its abilities/aspects/fragments and their rules text —
// the atoms a loadout's loop is reasoned from. Returns undefined if no subclass is equipped.
async function subclassMechanics(
  items: DestinyItem[],
  plugsByInstance: Map<string, number[]>,
): Promise<{ name: string; plugs: { name: string; description: string }[] } | undefined> {
  for (const item of items) {
    const meta = await itemMeta(item.itemHash);

    if (meta?.itemType !== SUBCLASS_ITEM_TYPE) {
      continue;
    }

    const plugHashes = item.itemInstanceId ? (plugsByInstance.get(item.itemInstanceId) ?? []) : [];
    const plugs = (await describePlugs(plugHashes)).filter((plug) => plug.description);

    return { name: meta.name, plugs };
  }

  return undefined;
}

// The exotic perks among a character's equipped gear, each as name + rules text — the build's
// multiplier, surfaced so the loop can be reasoned without a follow-up inspect_item.
async function exoticPerks(items: DestinyItem[]): Promise<ExoticPerk[]> {
  const resolved = await Promise.all(
    items.map(async (item): Promise<ExoticPerk | undefined> => {
      const meta = await itemMeta(item.itemHash);

      if (meta?.rarity !== "Exotic") {
        return undefined;
      }

      const perks = (await intrinsicPerks(item.itemHash)).filter((perk) => perk.description);

      return { name: meta.name, perks };
    }),
  );

  return resolved.filter((exotic): exotic is ExoticPerk => exotic !== undefined);
}

interface ExoticPerk {
  name: string;
  perks: { name: string; description: string }[];
}

interface SetBonus {
  set: string;
  pieces: number;
  active: string[];
  next?: { perk: string; needed: number };
}

// Tally equipped armor by set and report bonus progress: which set perks are live at the current
// piece count and how many more pieces unlock the next one. This is the reasoning a player wants
// when deciding whether to keep a piece, so the tool does the counting rather than leaving it to
// be re-derived from a flat item list every time.
async function setBonuses(items: DestinyItem[]): Promise<SetBonus[]> {
  const countByHash = new Map<number, number>();

  for (const item of items) {
    const meta = await itemMeta(item.itemHash);

    if (meta?.setHash) {
      countByHash.set(meta.setHash, (countByHash.get(meta.setHash) ?? 0) + 1);
    }
  }

  const bonuses = await Promise.all(
    [...countByHash].map(async ([setHash, pieces]): Promise<SetBonus | undefined> => {
      const set = await equipableItemSet(setHash);

      if (!set) {
        return undefined;
      }

      const active = set.perks.filter((perk) => pieces >= perk.requiredCount);
      const upcoming = set.perks
        .filter((perk) => pieces < perk.requiredCount)
        .sort((a, b) => a.requiredCount - b.requiredCount)[0];

      return {
        set: set.name,
        pieces,
        active: active.map((perk) => perk.name),
        next: upcoming
          ? { perk: upcoming.name, needed: upcoming.requiredCount - pieces }
          : undefined,
      };
    }),
  );

  return bonuses.filter((bonus): bonus is SetBonus => bonus !== undefined);
}

export function registerGetEquipped(server: McpServer): void {
  server.registerTool(
    "get_equipped",
    {
      description:
        "List the currently equipped items for each character. Each item reports its slot, element, type, rarity tier, and gear tier (the 1-5 Edge of Fate scale, armor only), so element matching and the one-exotic-weapon limit can be reasoned about directly — no follow-up inspect_item needed for those attributes. Each character also reports its armor set bonuses (which set perks are active and how many more pieces the next needs), the equipped subclass's abilities/aspects/fragments with rules text, and each exotic's perk — the mechanical atoms to reason out how the loadout plays against the verbs and method in get_build_knowledge.",
      inputSchema: { characterId: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ characterId }) => {
      const profile = await getEquippedProfile();
      const equipment = profile.characterEquipment;
      const plugsByInstance = socketPlugsByInstance(profile);

      const entries = Object.entries(equipment).filter(
        ([id]) => !characterId || id === characterId,
      );
      const result = await Promise.all(
        entries.map(async ([id, bucket]) => ({
          characterId: id,
          class: ClassType[profile.characters[id]?.classType ?? -1] ?? "Unknown",
          equipped: await inventoryItems(bucket.items, plugsByInstance),
          setBonuses: await setBonuses(bucket.items),
          subclass: await subclassMechanics(bucket.items, plugsByInstance),
          exotics: await exoticPerks(bucket.items),
        })),
      );

      return json(result);
    },
  );
}
