import type { CardModel } from "./model.js";

/** An MCP image content block: base64 bytes plus their MIME type, fed straight into the model's view. */
interface ImageBlock {
  type: "image";
  data: string;
  mimeType: string;
}

/**
 * Fetch a loadout's gear icons from Bungie's CDN and return one MCP image block per item, in
 * card order (subclass, then weapons, then armor) so they line up with the text card's rows.
 * Items whose icon is missing or fails to download are skipped rather than aborting the set.
 */
export async function iconBlocks(model: CardModel): Promise<ImageBlock[]> {
  const paths = model.sections.flatMap((section) =>
    section.rows.flatMap((row) => (row.icon && !row.empty ? [row.icon] : [])),
  );

  const blocks = await Promise.all(paths.map(fetchIcon));

  return blocks.filter((block): block is ImageBlock => block !== undefined);
}

/**
 * The element pip overlaid on a weapon icon, keyed by element name → its DestinyDamageTypeDefinition
 * icon path. Stable manifest paths, hardcoded so the renderer needn't resolve a damage-type lookup.
 */
export const ELEMENT_PIP: Record<string, string> = {
  Arc: "/common/destiny2_content/icons/DestinyDamageTypeDefinition_092d066688b879c807c3b460afdd61e6.png",
  Solar:
    "/common/destiny2_content/icons/DestinyDamageTypeDefinition_2a1773e10968f2d088b97c22b22bba9e.png",
  Void: "/common/destiny2_content/icons/DestinyDamageTypeDefinition_ceb2f6197dccf3958bb31cc783eb97a0.png",
  Stasis:
    "/common/destiny2_content/icons/DestinyDamageTypeDefinition_530c4c3e7981dc2aefd24fd3293482bf.png",
  Strand:
    "/common/destiny2_content/icons/DestinyDamageTypeDefinition_b2fe51a94f3533f97079dfa0d27a4096.png",
  Kinetic:
    "/common/destiny2_content/icons/DestinyDamageTypeDefinition_3385a924fd3ccb92c343ade19f19a370.png",
};

/**
 * Fetch every icon a card shows — item icons, plug icons, and weapon element pips — and return a
 * map from CDN path to a base64 `data:` URI. The card iframe renders these inline: Claude Desktop's
 * MCP-App sandbox blocks remote image hosts but allows `data:` URIs, and the map rides in
 * structuredContent, which never enters the model's context (no token cost). Deduped by path, so a
 * repeated mod or the shared element pip downloads and encodes once.
 */
export async function iconMap(model: CardModel): Promise<Record<string, string>> {
  const paths = new Set<string>();

  for (const section of model.sections) {
    const weapon = section.label === "WEAPONS";

    for (const row of section.rows) {
      if (row.icon) {
        paths.add(row.icon);
      }

      if (row.watermark) {
        paths.add(row.watermark);
      }

      if (weapon && row.element && ELEMENT_PIP[row.element]) {
        paths.add(ELEMENT_PIP[row.element]);
      }

      for (const plug of row.plugs ?? []) {
        if (plug.icon) {
          paths.add(plug.icon);
        }
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

/**
 * Download a single icon by its manifest-relative path and wrap it as an image block. Results are
 * cached for the process lifetime — the same icon (an exotic, a subclass) recurs across loadouts,
 * and the bytes never change for a given path. Returns undefined on any network/HTTP failure so a
 * dead icon degrades to a missing tile instead of failing the whole render.
 */
export async function fetchIcon(path: string): Promise<ImageBlock | undefined> {
  const cached = cache.get(path);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`${BUNGIE_NET}${path}`);

    if (!response.ok) {
      return undefined;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type")?.split(";")[0] || mimeFromPath(path);
    const block: ImageBlock = { type: "image", data: buffer.toString("base64"), mimeType };

    cache.set(path, block);
    return block;
  } catch {
    return undefined;
  }
}

// Icons live on the CDN root, not under /Platform — the manifest path already carries the full
// /common/destiny2_content/... prefix, so we only prepend the host.
const BUNGIE_NET = "https://www.bungie.net";

const cache = new Map<string, ImageBlock>();

function mimeFromPath(path: string): string {
  return path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}
