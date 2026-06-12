import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { equipableItemSet, itemMeta } from "../bungie/manifest.js";
import { ClassType, Component, type DestinyItem, getProfile } from "../bungie/profile.js";
import { inventoryItems, socketPlugsByInstance } from "./inventory.js";
import { json } from "./response.js";

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
        "List the currently equipped items for each character. Each item reports its slot, element, type, rarity tier, and gear tier (the 1-5 Edge of Fate scale, armor only), so element matching and the one-exotic-weapon limit can be reasoned about directly — no follow-up inspect_item needed for those attributes. Each character also reports its armor set bonuses: which set perks are active at the current piece count and how many more pieces the next bonus needs.",
      inputSchema: { characterId: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ characterId }) => {
      const profile = await getProfile([
        Component.Characters,
        Component.CharacterEquipment,
        Component.ItemSockets,
      ]);
      const equipment = profile.characterEquipment?.data ?? {};
      const plugsByInstance = socketPlugsByInstance(profile);

      const entries = Object.entries(equipment).filter(
        ([id]) => !characterId || id === characterId,
      );
      const result = await Promise.all(
        entries.map(async ([id, bucket]) => ({
          characterId: id,
          class: ClassType[profile.characters?.data?.[id]?.classType ?? -1] ?? "Unknown",
          equipped: await inventoryItems(bucket.items, plugsByInstance),
          setBonuses: await setBonuses(bucket.items),
        })),
      );

      return json(result);
    },
  );
}
