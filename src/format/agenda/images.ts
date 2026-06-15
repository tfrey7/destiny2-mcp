import { armorIconMap } from "../armor/images.js";
import { fetchIcon } from "../loadout/images.js";
import { titleDetailIconMap } from "../title/images.js";
import { triumphIconMap } from "../triumphs/images.js";
import { weaponIconMap } from "../weapon/images.js";
import type { AgendaCardModel, AgendaEmbed } from "./model.js";

/**
 * Fetch every agenda item's icon and return a map from its CDN path to a base64 `data:` URI. The
 * timeline iframe renders these inline — Claude Desktop's MCP-App sandbox blocks remote image hosts
 * but allows `data:` URIs, and the map rides in structuredContent, which never enters the model's
 * context (no token cost). Deduped by path, and `fetchIcon` is process-cached, so a shared icon
 * downloads once. Reuses the loadout module's downloader; the bytes are identical regardless of which
 * card shows them.
 */
export async function agendaIconMap(model: AgendaCardModel): Promise<Record<string, string>> {
  const paths = new Set<string>();
  const embeds: AgendaEmbed[] = [];

  if (model.objectiveEmbed) {
    embeds.push(model.objectiveEmbed);
  }

  for (const phase of model.phases) {
    for (const item of phase.items) {
      if (item.icon) {
        paths.add(item.icon);
      }

      if (item.embed) {
        embeds.push(item.embed);
      }
    }
  }

  const map: Record<string, string> = {};

  // An embed reuses its card's own icon map (already base64 data: URIs) so the inline card draws exactly
  // the icons the standalone card would; merge them in alongside the items' plain thumbnails.
  const [, ...embedMaps] = await Promise.all([
    Promise.all(
      [...paths].map(async (path) => {
        const block = await fetchIcon(path);

        if (block) {
          map[path] = `data:${block.mimeType};base64,${block.data}`;
        }
      }),
    ),
    ...embeds.map(embedIconMap),
  ]);

  for (const embedMap of embedMaps) {
    Object.assign(map, embedMap);
  }

  return map;
}

// The icon map for one embed, delegating to the matching card's own icon map so the inline render shows
// identical art (weapon perks/element pip, etc.).
function embedIconMap(embed: AgendaEmbed): Promise<Record<string, string>> {
  if (embed.kind === "weapon") {
    return weaponIconMap(embed.card);
  }

  if (embed.kind === "armor") {
    return armorIconMap(embed.card);
  }

  if (embed.kind === "title") {
    return titleDetailIconMap(embed.detail);
  }

  return triumphIconMap({ title: "", subtitle: "", tiles: [embed.tile] });
}
