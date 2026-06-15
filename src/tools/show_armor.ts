import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { armorSockets, armorStats } from "../bungie/armor.js";
import { armorSlot, equipableItemSet, gearTierFromPlugs, itemMeta } from "../bungie/manifest.js";
import { Component, type FullProfile, getProfile } from "../bungie/profile.js";
import { ARMOR_UI_RESOURCE_URI } from "../format/armor/html.js";
import type { ArmorCard } from "../format/armor/index.js";
import { armorTip } from "../knowledge/armor_tips.js";
import { instanceMap } from "./inventory.js";
import { armorCard, json } from "./response.js";
import { clientSupportsUi } from "./ui_capability.js";

// DestinyItemType for armor — the same signal categoryOf / search_items key off, so the armor-only
// gate here can't drift from how the rest of the server classifies an item.
const ARMOR_ITEM_TYPE = 2;

// The profile slice the card needs: per-instance sockets (mods, gear-tier plugs) and stats.
type ArmorCardProfile = Pick<FullProfile, "itemSockets" | "itemStats">;

export function registerShowArmor(server: McpServer): void {
  server.registerTool(
    "show_armor",
    {
      description:
        "Render an armor piece as an in-game-style inspect card: its icon, class, slot, rarity, and " +
        "gear tier up top, then the six Armor 3.0 archetype stats (Weapons, Health, Grenade, Super, " +
        "Class, Melee) as a value + bar block — the headline — followed by the exotic's intrinsic perk, " +
        "the armor set's 2/4-piece set bonuses, and the slotted mods, each with a hover tooltip. This is " +
        "how you answer 'show me <armor>', 'what are this piece's stats', or an inspect request for an " +
        "armor piece. Armor stats are PER-COPY (each drop rolls its own spread), so the stat block " +
        "appears only for an owned copy: pass an itemInstanceId (from list_inventory / get_equipped) to " +
        "show that one copy with its real rolled stats, gear tier, and slotted mods. Pass an itemHash " +
        "(resolve one with search_items) for a piece the player doesn't own — the card shows its exotic " +
        "perk and set bonuses but omits the stat block, since an unowned piece has no roll. When the " +
        "player owns several copies of the same piece (common for exotics), resolve each copy's " +
        "itemInstanceId with list_inventory and call show_armor once per copy — one card each, each with " +
        "its own stats. Armor only — use show_weapon for a weapon, show_item for any item's icon, or " +
        "inspect_item for raw mechanics as JSON. The card IS the answer; don't restate its stats in prose.",
      inputSchema: {
        itemHash: z.number().int().optional(),
        itemInstanceId: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: ARMOR_UI_RESOURCE_URI, visibility: ["model", "app"] } },
    },
    async ({ itemHash, itemInstanceId }) => {
      let hash = itemHash;
      let profile: ArmorCardProfile | null = null;

      // An instanceId names a specific owned copy; its live stats and sockets supply the real roll,
      // gear tier, and slotted mods, so fetch the profile once and reuse it for the hash lookup and
      // the socket/stat reads. An explicit itemHash wins and needs no profile — the card shows the
      // manifest piece (base stats, exotic perk, set bonuses; no per-copy roll or mods).
      if (hash === undefined) {
        if (itemInstanceId === undefined) {
          throw new Error("[destiny2-mcp] show_armor requires an itemHash or itemInstanceId.");
        }

        const fetched = await getProfile([
          Component.Characters,
          Component.CharacterEquipment,
          Component.CharacterInventories,
          Component.ProfileInventories,
          Component.ItemSockets,
          Component.ItemStats,
        ]);

        profile = fetched;
        hash = instanceMap(fetched).get(itemInstanceId);

        if (hash === undefined) {
          throw new Error(`[destiny2-mcp] No item found for instance ${itemInstanceId}.`);
        }
      }

      const meta = await itemMeta(hash);

      if (!meta) {
        return json({ error: `No item found for hash ${hash >>> 0}.` });
      }

      if (meta.itemType !== ARMOR_ITEM_TYPE) {
        return json({
          error: `${meta.name} is not an armor piece (${meta.type || "unknown type"}). show_armor is armor-only — use show_weapon for a weapon, show_item for its icon, or inspect_item for its mechanics.`,
        });
      }

      const spec = await armorCardSpec(hash, itemInstanceId, profile);

      // UI-capable hosts get the interactive card via structuredContent; the CLI falls through to the
      // text card. The card is visual-only — no action button — like show_weapon / show_equipped.
      return armorCard(spec, { ui: clientSupportsUi(server) });
    },
  );
}

/**
 * Assemble an ArmorCard from an armor hash: its header attributes (from the manifest), the six
 * archetype stats, the exotic intrinsic perk and slotted mods (armorSockets), the set bonuses, and —
 * for an owned copy — the gear tier. With an itemInstanceId and the matching profile, the stats are
 * that copy's real roll, the mods are what's slotted, and the gear tier resolves; without one, it's
 * the manifest piece (base stats, no mods, no tier). Shared by show_armor and the browser preview
 * harness so the two render byte-identical specs.
 */
export async function armorCardSpec(
  hash: number,
  itemInstanceId: string | undefined,
  profile: ArmorCardProfile | null,
): Promise<ArmorCard> {
  const [meta, sockets] = await Promise.all([
    itemMeta(hash),
    armorSockets(hash, itemInstanceId, profile),
  ]);

  // Stats are per-copy: only an owned instance has a real roll. A manifest piece (no instance) has no
  // meaningful archetype stats — the definition's are placeholder zeros — so the card omits the stat
  // block entirely (empty array) rather than show a misleading row of empty bars; the renderers note
  // that stats are per-copy instead.
  const liveStats =
    itemInstanceId && profile ? (profile.itemStats[itemInstanceId]?.stats ?? {}) : undefined;

  // Gear tier is per-instance — decoded from the masterwork plug on the live sockets; absent for a
  // manifest piece (no instance) and for legacy pre-tier armor.
  const live =
    itemInstanceId && profile ? (profile.itemSockets[itemInstanceId]?.sockets ?? []) : [];
  const plugHashes = live
    .filter(
      (socket) =>
        socket.isVisible !== false && socket.isEnabled !== false && socket.plugHash !== undefined,
    )
    .map((socket) => socket.plugHash as number);

  const [stats, gearTier, set] = await Promise.all([
    liveStats ? armorStats(liveStats) : [],
    itemInstanceId ? gearTierFromPlugs(plugHashes) : undefined,
    meta?.setHash ? equipableItemSet(meta.setHash) : undefined,
  ]);

  const card: ArmorCard = {
    name: meta?.name ?? `Item ${hash >>> 0}`,
    type: meta?.type ?? "",
    rarity: meta?.rarity ?? "Basic",
    className: meta?.className,
    slot: armorSlot(meta?.bucketHash),
    gearTier,
    icon: meta?.icon,
    watermark: meta?.watermark,
    hash,
    stats,
    exoticPerk: sockets.exoticPerk,
    set: set ? { name: set.name, bonuses: set.perks } : undefined,
    mods: sockets.mods,
    instance: itemInstanceId !== undefined,
  };

  card.tips = usageTips(card);
  return card;
}

// Collect the curated usage blurb for an exotic — keyed by the exotic's name, falling back to its
// intrinsic perk's name — labeled with the exotic's name. The map only holds entries for exotics whose
// usage is non-obvious, so a legendary or a plain-stat exotic yields an empty list (and no "HOW TO
// USE" section). One entry per card: an armor piece has a single exotic intrinsic, not a perk grid.
function usageTips(card: ArmorCard): { perk: string; tip: string }[] {
  if (card.rarity !== "Exotic") {
    return [];
  }

  const tip = armorTip(card.name) ?? (card.exoticPerk ? armorTip(card.exoticPerk.name) : undefined);

  return tip ? [{ perk: card.name, tip }] : [];
}
