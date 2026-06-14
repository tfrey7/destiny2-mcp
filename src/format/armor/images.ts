import { fetchIcon } from "../loadout/images.js";
import type { ArmorCard } from "./model.js";

/** An MCP image content block: base64 bytes plus their MIME type, fed straight into the model's view. */
interface ImageBlock {
  type: "image";
  data: string;
  mimeType: string;
}

/**
 * The armor piece's own icon as a single model-visible image block, or undefined when it has none or
 * the download fails. Only the piece's art is surfaced to the model — the exotic-perk and mod icons
 * stay inline in structuredContent (see armorIconMap) so they cost no tokens and don't flood the view.
 */
export async function armorIconBlock(card: ArmorCard): Promise<ImageBlock | undefined> {
  return card.icon ? fetchIcon(card.icon) : undefined;
}

/**
 * Fetch every icon the card shows — the piece, its exotic perk, and each slotted mod — and return a
 * map from CDN path to a base64 `data:` URI. The iframe renders these inline because Claude Desktop's
 * MCP-App sandbox blocks remote image hosts (it allows `data:` URIs), and the map rides in
 * structuredContent, which never enters the model's context (no token cost). Deduped by path.
 */
export async function armorIconMap(card: ArmorCard): Promise<Record<string, string>> {
  const paths = new Set<string>();

  if (card.icon) {
    paths.add(card.icon);
  }

  if (card.exoticPerk?.icon) {
    paths.add(card.exoticPerk.icon);
  }

  for (const mod of card.mods) {
    if (mod.icon) {
      paths.add(mod.icon);
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
