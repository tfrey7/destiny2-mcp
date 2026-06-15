import { fetchIcon } from "../loadout/images.js";
import type { TitleDetailModel } from "./model.js";

/**
 * Fetch the seal emblem and every member-Triumph icon, returning a map from each CDN path to a
 * base64 `data:` URI. The detail card's iframe renders these inline — Claude Desktop's MCP-App
 * sandbox blocks remote image hosts but allows `data:` URIs, and the map rides in structuredContent,
 * which never enters the model's context (no token cost). Deduped by path, and `fetchIcon` is
 * process-cached, so a shared icon downloads once.
 */
export async function titleDetailIconMap(model: TitleDetailModel): Promise<Record<string, string>> {
  const paths = new Set<string>();

  if (model.icon) {
    paths.add(model.icon);
  }

  for (const triumph of model.triumphs) {
    if (triumph.icon) {
      paths.add(triumph.icon);
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
