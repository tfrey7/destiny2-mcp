import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { itemMeta } from "../bungie/manifest.js";
import { Component, getProfile } from "../bungie/profile.js";
import { fetchIcon } from "../format/loadout/images.js";
import { instanceMap } from "./inventory.js";

export function registerShowItem(server: McpServer): void {
  server.registerTool(
    "show_item",
    {
      description:
        "Show what an item looks like: fetch its icon from the manifest and return it as an image the model can see. These icons are first-party game art the manifest ships expressly to be displayed — the loadout card already renders them — so this is the right way to answer 'show me the icon for X' or 'what does X look like'. Do NOT web-search for an item's art or decline on copyright grounds; resolve the item here. Pass an itemHash (resolve one with search_items — e.g. search_items type:'Hand Cannon' tier:'Exotic' sort:'newest' for the latest exotic hand cannon, then show its hash) or an itemInstanceId for a specific owned copy. Returns the item's name, type, rarity, and element alongside the icon. For an item's mechanics (perks, stats) use inspect_item instead; this is purely the visual.",
      inputSchema: {
        itemHash: z.number().int().optional(),
        itemInstanceId: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ itemHash, itemInstanceId }) => {
      const hash = await resolveHash(itemHash, itemInstanceId);
      const meta = await itemMeta(hash);

      if (!meta) {
        throw new Error(`[destiny2-mcp] No item found for hash ${hash >>> 0}.`);
      }

      const element = meta.element ? `, ${meta.element}` : "";
      const summary = `${meta.name} — ${meta.rarity} ${meta.type}${element}.`;
      const block = meta.icon ? await fetchIcon(meta.icon) : undefined;

      if (!block) {
        return {
          content: [
            { type: "text" as const, text: `${summary}\nNo icon is available for this item.` },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: `${summary} Icon shown.` }, block],
      };
    },
  );
}

// An instanceId names a specific owned copy; map it to its definition hash the way inspect_item does.
// An explicit itemHash wins when both are given. Exactly one must be supplied.
async function resolveHash(
  itemHash: number | undefined,
  itemInstanceId: string | undefined,
): Promise<number> {
  if (itemHash !== undefined) {
    return itemHash;
  }

  if (itemInstanceId === undefined) {
    throw new Error("[destiny2-mcp] show_item requires an itemHash or itemInstanceId.");
  }

  const profile = await getProfile([
    Component.CharacterEquipment,
    Component.CharacterInventories,
    Component.ProfileInventories,
  ]);
  const hash = instanceMap(profile).get(itemInstanceId);

  if (!hash) {
    throw new Error(`[destiny2-mcp] No item found for instance ${itemInstanceId}.`);
  }

  return hash;
}
