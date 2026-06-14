import { fetchIcon } from "../loadout/images.js";
import type { RecapCardModel } from "./model.js";

/**
 * Fetch the recap card's PGCR backdrop and return a map from its CDN path to a base64 `data:` URI.
 * The dashboard iframe renders it inline — Claude Desktop's MCP-App sandbox blocks remote image hosts
 * but allows `data:` URIs, and the map rides in structuredContent, which never enters the model's
 * context (no token cost). Reuses the loadout module's process-cached downloader; PGCR art is a JPG,
 * which `fetchIcon` handles the same as an icon.
 */
export async function recapIconMap(model: RecapCardModel): Promise<Record<string, string>> {
  if (!model.pgcrImage) {
    return {};
  }

  const block = await fetchIcon(model.pgcrImage);

  if (!block) {
    return {};
  }

  return { [model.pgcrImage]: `data:${block.mimeType};base64,${block.data}` };
}
