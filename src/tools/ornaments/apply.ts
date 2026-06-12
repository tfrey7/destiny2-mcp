import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { itemMeta } from "../../bungie/manifest.js";
import { ClassType, Component, getProfile } from "../../bungie/profile.js";
import { insertableSocketIndex } from "../../bungie/sockets.js";
import { action } from "../actions.js";
import { ok } from "../response.js";
import { loadOrnaments, type OrnamentSlot } from "./logic.js";

const BUCKET_BY_SLOT: Record<OrnamentSlot, number> = {
  helmet: 3448274439,
  arms: 3551918588,
  chest: 14239492,
  legs: 20886954,
  class: 1585787867,
};

export function registerApplyOrnament(server: McpServer): void {
  server.registerTool(
    "apply_ornament",
    {
      description:
        "Apply a universal armor ornament to a character's currently-equipped armor — the equip step " +
        "behind a find_ornaments pick. Pass the characterId (from list_characters / get_equipped) and the " +
        "plugItemHash from a find_ornaments result; the tool reads the ornament's slot and class, finds " +
        "the armor equipped in that slot, confirms the ornament is unlocked and fits, and inserts it. " +
        "Free and reversible — it changes only the cosmetic socket. Errors if the ornament's class doesn't " +
        "match the character, if nothing is equipped in that slot, or if the ornament isn't unlocked or " +
        "the equipped piece can't take it (e.g. an exotic).",
      inputSchema: {
        characterId: z.string(),
        plugItemHash: z.number().int(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ characterId, plugItemHash }) => {
      const ornament = (await loadOrnaments()).find((entry) => Number(entry.hash) === plugItemHash);

      if (!ornament) {
        throw new Error(
          `[destiny2-mcp] ${plugItemHash} is not a known universal ornament — use find_ornaments to get one.`,
        );
      }

      const profile = await getProfile([
        Component.Characters,
        Component.CharacterEquipment,
        Component.ItemSockets,
        Component.ItemReusablePlugs,
      ]);

      const character = profile.characters?.data?.[characterId];

      if (!character) {
        throw new Error(`[destiny2-mcp] No character ${characterId} on this account.`);
      }

      const characterClass = ClassType[character.classType] ?? "Unknown";

      if (characterClass !== ornament.class) {
        throw new Error(
          `[destiny2-mcp] ${ornament.name} is a ${ornament.class} ornament, but character ${characterId} is a ${characterClass}.`,
        );
      }

      const bucket = BUCKET_BY_SLOT[ornament.slot];
      const equipped = profile.characterEquipment?.data?.[characterId]?.items ?? [];
      let target: { itemHash: number; itemInstanceId?: string } | undefined;

      for (const item of equipped) {
        const meta = await itemMeta(item.itemHash);

        if (meta?.bucketHash === bucket) {
          target = item;
          break;
        }
      }

      if (!target?.itemInstanceId) {
        throw new Error(
          `[destiny2-mcp] No armor equipped in the ${ornament.slot} slot on character ${characterId}.`,
        );
      }

      const socketIndex = await insertableSocketIndex(
        profile,
        target.itemInstanceId,
        target.itemHash,
        plugItemHash,
      );

      if (socketIndex === undefined) {
        throw new Error(
          `[destiny2-mcp] Can't apply ${ornament.name}: either it isn't unlocked on this account, or the ` +
            `equipped ${ornament.slot} piece doesn't take universal ornaments (e.g. an exotic). ` +
            `Run inspect_sockets on ${target.itemInstanceId} to see what's available.`,
        );
      }

      const response = await action("/Destiny2/Actions/Items/InsertSocketPlugFree/", {
        plug: { socketIndex, socketArrayType: 0, plugItemHash },
        itemId: target.itemInstanceId,
        characterId,
      });

      return ok(
        `Applied ${ornament.name} to the equipped ${ornament.slot} on your ${characterClass}.`,
        response,
      );
    },
  );
}
