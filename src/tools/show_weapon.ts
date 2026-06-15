import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ammoTypeLabel, itemDefinition, itemMeta } from "../bungie/manifest.js";
import { Component, getProfile } from "../bungie/profile.js";
import { weaponSockets, type WeaponSockets, type WeaponSocketProfile } from "../bungie/weapon.js";
import { WEAPON_UI_RESOURCE_URI } from "../format/weapon/html.js";
import type { WeaponCard } from "../format/weapon/index.js";
import { perkTip } from "../knowledge/perk_tips.js";
import { intrinsicTip } from "../knowledge/playstyle_tips.js";
import { instanceMap } from "./inventory.js";
import { json, weaponCard } from "./response.js";
import { clientSupportsUi } from "./ui_capability.js";

// DestinyItemType for a weapon — the same signal categoryOf / search_items key off, so the weapons-only
// gate here can't drift from how the rest of the server classifies an item.
const WEAPON_ITEM_TYPE = 3;

export function registerShowWeapon(server: McpServer): void {
  server.registerTool(
    "show_weapon",
    {
      description:
        "Render a weapon as an in-game-style inspect card: its icon, type, rarity, element, and ammo up " +
        "top, then the perk grid — the intrinsic frame plus each perk column's candidate perks, with a " +
        "hover tooltip naming each perk and what it does. This is how you answer 'show me <weapon>', " +
        "'what perks can roll on <weapon>', or an inspect request for a weapon. Pass an itemHash (resolve " +
        "one with search_items) to show the full pool of perks that CAN roll per column; pass an " +
        "itemInstanceId (from list_inventory / get_equipped) to show that one copy with the perks it " +
        "actually has, its equipped roll highlighted. Each card is a single copy: if the player owns " +
        "several copies of the same weapon with different rolls, resolve each copy's itemInstanceId with " +
        "list_inventory and call show_weapon once per copy — one card each. Weapons only — use show_item " +
        "for any item's icon, or inspect_item for an item's raw mechanics as JSON. The card IS the " +
        "answer; don't restate its perks in prose.",
      inputSchema: {
        itemHash: z.number().int().optional(),
        itemInstanceId: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: WEAPON_UI_RESOURCE_URI, visibility: ["model", "app"] } },
    },
    async ({ itemHash, itemInstanceId }) => {
      let hash = itemHash;
      let profile: WeaponSocketProfile | null = null;

      // An instanceId names a specific owned copy; its live sockets supply the rolled perk per column,
      // so fetch the profile once and reuse it for the hash lookup and the socket walk. An explicit
      // itemHash wins and needs no profile — the card shows the manifest's full candidate pool.
      if (hash === undefined) {
        if (itemInstanceId === undefined) {
          throw new Error("[destiny2-mcp] show_weapon requires an itemHash or itemInstanceId.");
        }

        const fetched = await getProfile([
          Component.Characters,
          Component.CharacterEquipment,
          Component.CharacterInventories,
          Component.ProfileInventories,
          Component.ItemSockets,
          Component.ItemReusablePlugs,
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

      if (meta.itemType !== WEAPON_ITEM_TYPE) {
        return json({
          error: `${meta.name} is not a weapon (${meta.type || "unknown type"}). show_weapon is weapons-only — use show_item for its icon, or inspect_item for its mechanics.`,
        });
      }

      const spec = await weaponCardSpec(hash, itemInstanceId, profile);

      // UI-capable hosts get the interactive grid via structuredContent; the CLI falls through to the
      // text card. The card is visual-only — no action button — like show_item / show_equipped.
      return weaponCard(spec, { ui: clientSupportsUi(server) });
    },
  );
}

/**
 * Assemble a WeaponCard from a weapon hash: its header attributes (from the manifest) plus the resolved
 * perk grid (weaponSockets). With an itemInstanceId and the matching profile, the grid marks the rolled
 * perk per column; without one, it shows the manifest's full candidate pool. Shared by show_weapon and
 * the browser preview harness so the two render byte-identical specs.
 */
export async function weaponCardSpec(
  hash: number,
  itemInstanceId: string | undefined,
  profile: WeaponSocketProfile | null,
): Promise<WeaponCard> {
  const [meta, definition, sockets] = await Promise.all([
    itemMeta(hash),
    itemDefinition(hash),
    weaponSockets(hash, itemInstanceId, profile),
  ]);

  return {
    name: meta?.name ?? `Item ${hash >>> 0}`,
    type: meta?.type ?? "",
    rarity: meta?.rarity ?? "Basic",
    element: meta?.element,
    ammoType: ammoTypeLabel(definition.equippingBlock?.ammoType),
    icon: meta?.icon,
    watermark: meta?.watermark,
    hash,
    intrinsic: sockets.intrinsic,
    columns: sockets.columns,
    instance: itemInstanceId !== undefined,
    tips: usageTips(meta?.type ?? "", sockets),
  };
}

// Collect curated usage tips for the card — the intrinsic frame first, then notable column perks, each
// kept once. The intrinsic resolves through intrinsicTip (by weapon type × frame/exotic name), which
// always returns at least a per-type baseline, so every weapon shows a "HOW TO USE" block; column perks
// resolve through perkTip, which is sparse, so only perks whose sequencing actually matters add a row.
function usageTips(type: string, sockets: WeaponSockets): { perk: string; tip: string }[] {
  const tips: { perk: string; tip: string }[] = [];
  const seen = new Set<string>();

  const intrinsic = sockets.intrinsic;
  const intrinsicText = intrinsic ? intrinsicTip(type, intrinsic.name) : undefined;

  if (intrinsic && intrinsicText) {
    seen.add(intrinsic.name);
    tips.push({ perk: intrinsic.name, tip: intrinsicText });
  }

  for (const name of sockets.columns.flatMap((column) => column.plugs.map((plug) => plug.name))) {
    const tip = perkTip(name);

    if (tip && !seen.has(name)) {
      seen.add(name);
      tips.push({ perk: name, tip });
    }
  }

  return tips;
}
