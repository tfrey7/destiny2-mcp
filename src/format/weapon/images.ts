import { ELEMENT_PIP, fetchIcon } from "../loadout/images.js";
import type { WeaponCard } from "./model.js";

/** An MCP image content block: base64 bytes plus their MIME type, fed straight into the model's view. */
interface ImageBlock {
  type: "image";
  data: string;
  mimeType: string;
}

/**
 * The weapon's own icon as a single model-visible image block, or undefined when it has none or the
 * download fails. Only the weapon art is surfaced to the model — the dozens of perk icons stay inline
 * in structuredContent (see weaponIconMap) so they cost no tokens and don't flood the model's view.
 */
export async function weaponIconBlock(card: WeaponCard): Promise<ImageBlock | undefined> {
  return card.icon ? fetchIcon(card.icon) : undefined;
}

/**
 * Fetch every icon the card shows — the weapon, its element pip, the intrinsic frame, and every perk
 * in every column — and return a map from CDN path to a base64 `data:` URI. The iframe renders these
 * inline because Claude Desktop's MCP-App sandbox blocks remote image hosts (it allows `data:` URIs),
 * and the map rides in structuredContent, which never enters the model's context (no token cost).
 * Deduped by path, so a perk shared across columns downloads once.
 */
export async function weaponIconMap(card: WeaponCard): Promise<Record<string, string>> {
  const paths = new Set<string>();

  if (card.icon) {
    paths.add(card.icon);
  }

  if (card.element && ELEMENT_PIP[card.element]) {
    paths.add(ELEMENT_PIP[card.element]);
  }

  if (card.intrinsic?.icon) {
    paths.add(card.intrinsic.icon);
  }

  for (const column of card.columns) {
    for (const plug of column.plugs) {
      if (plug.icon) {
        paths.add(plug.icon);
      }
    }
  }

  const map: Record<string, string> = {};

  await Promise.all(
    [...paths].map(async (path) => {
      const block = await fetchIcon(path);

      if (block) {
        map[path] = `data:${block.mimeType};base64,${block.data}`;
      }
    }),
  );

  return map;
}
