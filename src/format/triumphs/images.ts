import { fetchIcon } from "../loadout/images.js";
import type { TriumphCardModel } from "./model.js";

/**
 * Fetch every Triumph tile's icon and return a map from its CDN path to a base64 `data:` URI. The
 * grid iframe renders these inline — Claude Desktop's MCP-App sandbox blocks remote image hosts but
 * allows `data:` URIs, and the map rides in structuredContent, which never enters the model's
 * context (no token cost). Deduped by path, and `fetchIcon` is process-cached, so a shared icon
 * downloads once. Reuses the loadout module's downloader; the bytes are identical regardless of
 * which card shows them.
 */
export async function triumphIconMap(model: TriumphCardModel): Promise<Record<string, string>> {
  const paths = new Set<string>();

  for (const tile of model.tiles) {
    if (tile.icon) {
      paths.add(tile.icon);
    }

    for (const reward of tile.rewards) {
      if (reward.icon) {
        paths.add(reward.icon);
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
