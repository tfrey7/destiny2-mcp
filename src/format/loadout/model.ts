import type { PlugView } from "../../bungie/plugs.js";
import { BUCKET, type CardSectionLabel, CLASS_ITEM_BUCKET, type Section } from "./data.js";

export interface LoadoutCardItem {
  name: string;
  rarity: string;
  type: string;
  element?: string;
  bucketHash: number;
  /** Relative Bungie CDN icon path; present when the source surfaced it (see ItemMeta.icon). */
  icon?: string;
  /** Relative Bungie CDN path of the season/episode watermark badge (see ItemMeta.watermark). */
  watermark?: string;
  /** The item's manifest hash, used to link the card name to its light.gg page. */
  hash?: number;
  /** Socketed plugs to show under the name: weapon perks, armor mods, or aspects + fragments. */
  plugs?: PlugView[];
  /** Whether the player already holds this piece — drives the owned/needed marker on a target build.
   * Omit (undefined) for real loadouts, where every piece is owned by definition and unmarked. */
  owned?: boolean;
}

export interface LoadoutCard {
  title: string;
  className: string;
  /** Saved-loadout slot index. Omit for community builds, which have no slot. */
  slot?: number;
  /** Overrides the detail shown after the class name. Defaults to `slot N` when slot is set. */
  subtitle?: string;
  items: LoadoutCardItem[];
  /** The seasonal artifact to equip and the perks to choose on it, by name. Read-only over the API
   * (the player sets it in-game), so it renders as a names-only section — no icons or ownership. */
  artifact?: { name: string; perks: string[] };
}

export interface CardRow {
  name: string;
  rarity: string;
  /** Middle column: weapon type or armor slot label. */
  middle: string;
  /** Element name (e.g. "Strand"), when the item or subclass has one. */
  element?: string;
  /** Relative Bungie CDN icon path, for renderers that show the item's art. */
  icon?: string;
  /** Relative Bungie CDN path of the season/episode watermark, overlaid on the icon's top corner. */
  watermark?: string;
  /** The item's manifest hash, for the light.gg link on the name. */
  hash?: number;
  /** Socketed plugs (perks / mods / aspects + fragments) shown as icons with tooltips. */
  plugs?: PlugView[];
  /** Artifact perk names, listed as plain text under the row — the ARTIFACT section's perks have no
   * manifest icons yet, so they render as names rather than the icon plugs above. */
  perkNames?: string[];
  /** Whether the player holds this piece, when the card is a target build (see LoadoutCardItem.owned). */
  owned?: boolean;
  /** The placeholder row for a loadout with no class item equipped. */
  empty?: boolean;
}

interface CardSection {
  label: CardSectionLabel;
  rows: CardRow[];
}

export interface CardModel {
  title: string;
  subtitle: string;
  sections: CardSection[];
}

/**
 * Reduce a loadout to ordered sections and rows — the shared input for every card renderer.
 *
 * @example
 * {
 *   title: "Threadrunner",
 *   subtitle: "Hunter · slot 2",
 *   sections: [
 *     { label: "SUBCLASS", rows: [
 *       { name: "Strand Hunter", rarity: "Basic", middle: "Strand", element: "Strand" },
 *     ] },
 *     { label: "WEAPONS", rows: [
 *       { name: "Quicksilver Storm", rarity: "Exotic", middle: "Auto Rifle", element: "Strand" },
 *     ] },
 *     { label: "ARMOR", rows: [
 *       { name: "Mask of Bakris", rarity: "Exotic", middle: "Helmet" },
 *       { name: "—", rarity: "Basic", middle: "Class item", empty: true },
 *     ] },
 *   ],
 * }
 */
export function cardModel(card: LoadoutCard): CardModel {
  const detail = card.subtitle ?? (card.slot !== undefined ? `slot ${card.slot}` : undefined);
  const subtitle = detail ? `${card.className} · ${detail}` : card.className;
  const sections: CardSection[] = [];

  // Subclass leads the card — it sets the build's identity, the way loadouts read in-game / DIM.
  const subclass = inSection(card.items, "SUBCLASS")[0];

  if (subclass) {
    sections.push({
      label: "SUBCLASS",
      rows: [
        {
          name: subclass.name,
          rarity: subclass.rarity,
          middle: subclass.element ?? "",
          element: subclass.element,
          icon: subclass.icon,
          hash: subclass.hash,
          plugs: subclass.plugs,
        },
      ],
    });
  }

  const weapons = inSection(card.items, "WEAPONS");

  if (weapons.length > 0) {
    sections.push({
      label: "WEAPONS",
      rows: weapons.map((item) => ({
        name: item.name,
        rarity: item.rarity,
        middle: item.type,
        element: item.element,
        icon: item.icon,
        watermark: item.watermark,
        hash: item.hash,
        plugs: item.plugs,
        owned: item.owned,
      })),
    });
  }

  const armor = inSection(card.items, "ARMOR");

  const armorRows: CardRow[] = armor.map((item) => ({
    name: item.name,
    rarity: item.rarity,
    middle: BUCKET[item.bucketHash].label,
    icon: item.icon,
    watermark: item.watermark,
    hash: item.hash,
    plugs: item.plugs,
    owned: item.owned,
  }));

  if (!armor.some((item) => item.bucketHash === CLASS_ITEM_BUCKET)) {
    armorRows.push({ name: "—", rarity: "Basic", middle: "Class item", empty: true });
  }

  sections.push({ label: "ARMOR", rows: armorRows });

  // The artifact sits outside the gear buckets, so it isn't in card.items — it rides on its own field
  // and renders as a names-only section after the gear.
  if (card.artifact) {
    sections.push({
      label: "ARTIFACT",
      rows: [
        {
          name: card.artifact.name,
          rarity: "Basic",
          middle: "Artifact",
          perkNames: card.artifact.perks,
        },
      ],
    });
  }

  return { title: card.title, subtitle, sections };
}

function inSection(items: LoadoutCardItem[], section: Section): LoadoutCardItem[] {
  return items
    .filter((item) => BUCKET[item.bucketHash]?.section === section)
    .sort((a, b) => (BUCKET[a.bucketHash]?.order ?? 99) - (BUCKET[b.bucketHash]?.order ?? 99));
}
