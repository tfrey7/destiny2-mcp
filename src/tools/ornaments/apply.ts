import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { itemMeta } from "../../bungie/manifest.js";
import { ClassType, Component, getProfile, type ProfileFor } from "../../bungie/profile.js";
import { insertableSocketIndex } from "../../bungie/sockets.js";
import type { ClassName } from "../../schemas.js";
import { action } from "../actions.js";
import { json, ok } from "../response.js";
import { loadOrnaments, type Ornament, type OrnamentSlot } from "./logic.js";

const APPLY_COMPONENTS = [
  Component.Characters,
  Component.CharacterEquipment,
  Component.ItemSockets,
  Component.ItemReusablePlugs,
] as const;

type ApplyProfile = ProfileFor<typeof APPLY_COMPONENTS>;

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
        "the equipped piece can't take it (e.g. an exotic). To apply a whole look at once, use " +
        "apply_ornament_set.",
      inputSchema: {
        characterId: z.string(),
        plugItemHash: z.number().int(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ characterId, plugItemHash }) => {
      const profile = await getProfile(APPLY_COMPONENTS);
      const characterClass = characterClassOf(profile, characterId);
      const ornaments = await loadOrnaments();

      const result = await applyOne(
        profile,
        characterId,
        characterClass,
        plugItemHash,
        ornaments,
        new Set(),
      );

      if (result.status === "skipped") {
        throw new Error(
          `[destiny2-mcp] Can't apply ${result.name ?? plugItemHash}: ${result.reason}.`,
        );
      }

      return ok(
        `Applied ${result.name} to the equipped ${result.slot} on your ${characterClass}.`,
        result,
      );
    },
  );
}

export function registerApplyOrnamentSet(server: McpServer): void {
  server.registerTool(
    "apply_ornament_set",
    {
      description:
        "Apply several universal armor ornaments to a character in one call — the way to dress a whole " +
        "look (e.g. all five pieces of a themed set) from find_ornaments results. Pass the characterId and " +
        "an array of plugItemHashes. Each is applied to the armor equipped in its slot; any piece that " +
        "isn't unlocked, has nothing equipped in its slot, can't go on the equipped piece (e.g. an exotic), " +
        "or whose class doesn't match the character is skipped with a reason rather than failing the whole " +
        "call. If two hashes target the same slot, only the first is applied. Returns per-piece outcomes.",
      inputSchema: {
        characterId: z.string(),
        plugItemHashes: z.array(z.number().int()).min(1).max(10),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ characterId, plugItemHashes }) => {
      const profile = await getProfile(APPLY_COMPONENTS);
      const characterClass = characterClassOf(profile, characterId);
      const ornaments = await loadOrnaments();
      const usedSlots = new Set<OrnamentSlot>();
      const results = [];

      for (const plugItemHash of plugItemHashes) {
        results.push(
          await applyOne(profile, characterId, characterClass, plugItemHash, ornaments, usedSlots),
        );
      }

      const applied = results.filter((result) => result.status === "applied").length;

      return json({ class: characterClass, applied, total: plugItemHashes.length, results });
    },
  );
}

const BUCKET_BY_SLOT: Record<OrnamentSlot, number> = {
  helmet: 3448274439,
  arms: 3551918588,
  chest: 14239492,
  legs: 20886954,
  class: 1585787867,
};

interface ApplyResult {
  plugItemHash: number;
  name?: string;
  slot?: OrnamentSlot;
  status: "applied" | "skipped";
  reason?: string;
}

function characterClassOf(profile: ApplyProfile, characterId: string): ClassName {
  const character = profile.characters[characterId];

  if (!character) {
    throw new Error(`[destiny2-mcp] No character ${characterId} on this account.`);
  }

  return ClassType[character.classType] ?? "Unknown";
}

// Resolve a single ornament against the character's worn armor and insert it, returning a skip reason
// instead of throwing so a set application can carry on past pieces the player can't equip. usedSlots
// guards against two hashes fighting over the same slot.
async function applyOne(
  profile: ApplyProfile,
  characterId: string,
  characterClass: ClassName,
  plugItemHash: number,
  ornaments: Ornament[],
  usedSlots: Set<OrnamentSlot>,
): Promise<ApplyResult> {
  const ornament = ornaments.find((entry) => Number(entry.hash) === plugItemHash);

  if (!ornament) {
    return { plugItemHash, status: "skipped", reason: "not a known universal ornament" };
  }

  const base = { plugItemHash, name: ornament.name, slot: ornament.slot };

  if (ornament.class !== characterClass) {
    return {
      ...base,
      status: "skipped",
      reason: `${ornament.class} ornament, character is ${characterClass}`,
    };
  }

  if (usedSlots.has(ornament.slot)) {
    return {
      ...base,
      status: "skipped",
      reason: `another ornament already applied to the ${ornament.slot} slot`,
    };
  }

  const target = await equippedInSlot(profile, characterId, ornament.slot);

  if (!target) {
    return { ...base, status: "skipped", reason: `no armor equipped in the ${ornament.slot} slot` };
  }

  const socketIndex = await insertableSocketIndex(
    profile,
    target.itemInstanceId,
    target.itemHash,
    plugItemHash,
  );

  if (socketIndex === undefined) {
    return {
      ...base,
      status: "skipped",
      reason: "not unlocked, or the equipped piece (e.g. an exotic) can't take it",
    };
  }

  await action("/Destiny2/Actions/Items/InsertSocketPlugFree/", {
    plug: { socketIndex, socketArrayType: 0, plugItemHash },
    itemId: target.itemInstanceId,
    characterId,
  });

  usedSlots.add(ornament.slot);

  return { ...base, status: "applied" };
}

async function equippedInSlot(
  profile: ApplyProfile,
  characterId: string,
  slot: OrnamentSlot,
): Promise<{ itemHash: number; itemInstanceId: string } | undefined> {
  const bucket = BUCKET_BY_SLOT[slot];

  for (const item of profile.characterEquipment[characterId]?.items ?? []) {
    const meta = await itemMeta(item.itemHash);

    if (item.itemInstanceId && meta?.bucketHash === bucket) {
      return { itemHash: item.itemHash, itemInstanceId: item.itemInstanceId };
    }
  }

  return undefined;
}
