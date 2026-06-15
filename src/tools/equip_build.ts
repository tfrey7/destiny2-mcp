import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { itemDefinition, itemMeta, itemName, socketCategoryName } from "../bungie/manifest.js";
import { Component, getProfile, type ProfileFor } from "../bungie/profile.js";
import { assignPlugSockets, type PlugAssignment } from "../bungie/sockets.js";
import { BUCKET, type Section } from "../format/loadout/data.js";
import { action, itemHashFor } from "./actions.js";
import { actionReason, equipGear, type GearEquipResult, isNotInGame } from "./equip_core.js";
import { json } from "./response.js";

const EQUIP_BUILD_COMPONENTS = [
  Component.Characters,
  Component.CharacterEquipment,
  Component.CharacterInventories,
  Component.ProfileInventories,
  Component.ItemSockets,
  Component.ItemReusablePlugs,
] as const;

type EquipBuildProfile = ProfileFor<typeof EQUIP_BUILD_COMPONENTS>;

const itemSchema = z.object({
  itemId: z
    .string()
    .describe(
      "The item's INSTANCE id (from search_items / list_inventory / get_equipped / inspect_item) — not " +
        "its manifest hash. A weapon, an armor piece, or the subclass. Must be owned.",
    ),
  plugs: z
    .array(z.number().int())
    .optional()
    .describe(
      "Target plug hashes to insert into this item's sockets, in display order. For a weapon: the " +
        "perks per column (from god_roll / inspect_sockets — usually already on the rolled copy, so " +
        "omit unless changing them). For an armor piece: its mods. For the subclass: super, grenade, " +
        "melee, class ability, movement, BOTH aspects, and ALL fragments. Aspects are inserted before " +
        "fragments automatically. Each plug must be unlocked; any that isn't is skipped with a reason.",
    ),
});

export function registerEquipBuild(server: McpServer): void {
  server.registerTool(
    "equip_build",
    {
      description:
        "Apply a COMPLETE, owned build to a character in one call — the actuator counterpart to " +
        "show_build. Pass the character and the build's items by INSTANCE id: weapons, all five armor " +
        "pieces (each with its mod plug hashes), and the subclass (with its super/grenade/melee/class " +
        "ability/movement/aspects/fragments plug hashes). The tool moves every piece onto the character, " +
        "equips them (exotics last), equips the subclass, then inserts every subclass plug and armor mod " +
        "— collapsing the dozen-plus transfer/equip/insert_plug calls a build used to take into one. " +
        "Owned-only and actionable: use it for an EQUIP request once the spec is decided (see the " +
        "recommending/equipping knowledge). Partial by design — each piece and plug is applied " +
        "independently and reported, so one failure never sinks the rest. Equipping needs you signed " +
        "into Destiny 2 (Bungie error 1623); transfers and plug inserts work offline, so an out-of-game " +
        "call still lands those and reports which equips to finish in-game.",
      inputSchema: {
        characterId: z.string(),
        items: z.array(itemSchema).min(1),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ characterId, items }) => {
      const profile = await getProfile(EQUIP_BUILD_COMPONENTS);

      if (!profile.characters[characterId]) {
        throw new Error(`[destiny2-mcp] No character ${characterId} on this account.`);
      }

      const resolved = await Promise.all(items.map((item) => resolveItem(profile, item)));
      const subclass = resolved.find((item) => item.section === "SUBCLASS");
      const gearItems = resolved.filter((item) => item !== subclass);

      // Move + equip the weapons and armor in one batched call (exotics last); the subclass equips on
      // its own endpoint, since a subclass isn't part of an EquipItems gear batch.
      const gearOutcome = await equipGear(
        profile,
        characterId,
        gearItems.map((item) => item.itemId),
      );
      const subclassEquip = subclass ? await equipSubclass(characterId, subclass) : undefined;

      let liveActionRequired = gearOutcome.liveActionRequired || (subclassEquip?.live ?? false);

      // Fragment sockets share their plug set with each other, and stay disabled until the equipped
      // aspects grant capacity — so fragments must insert AFTER aspects. Mark the subclass's fragment
      // sockets so applyPlugs orders them last.
      const fragmentSockets =
        subclass?.hash !== undefined
          ? await fragmentSocketIndexes(subclass.hash)
          : new Set<number>();

      const plugGroups: PlugGroup[] = [];

      for (const item of resolved) {
        if (!item.plugs.length || item.hash === undefined) {
          continue;
        }

        const results = await applyPlugs(
          profile,
          characterId,
          item,
          item.hash,
          item === subclass ? fragmentSockets : EMPTY_SOCKETS,
        );

        liveActionRequired ||= results.some((result) => result.live);

        plugGroups.push({
          item: item.name,
          itemId: item.itemId,
          applied: results.filter((result) => result.status === "inserted").length,
          total: results.length,
          results: results.map(({ live: _live, ...rest }) => rest),
        });
      }

      const gear = [...gearOutcome.results, ...(subclassEquip ? [subclassEquip.result] : [])];

      return json({
        summary: summarize(characterId, gear, plugGroups, liveActionRequired),
        liveActionRequired,
        transfers: gearOutcome.notes || undefined,
        gear,
        plugs: plugGroups,
      });
    },
  );
}

interface ResolvedItem {
  itemId: string;
  hash?: number;
  name: string;
  section?: Section;
  plugs: number[];
}

interface PlugGroup {
  item: string;
  itemId: string;
  applied: number;
  total: number;
  results: { plugItemHash: number; name: string; status: PlugStatus; reason?: string }[];
}

type PlugStatus = "inserted" | "skipped" | "failed";

interface PlugApplyResult {
  plugItemHash: number;
  name: string;
  status: PlugStatus;
  reason?: string;
  // Whether this failure was the player being out of the game, bubbled up to the call's liveActionRequired.
  live?: boolean;
}

const EMPTY_SOCKETS: ReadonlySet<number> = new Set();

// Resolve an input item against the live profile: its definition hash (from the held instance), name,
// and which section (WEAPONS / ARMOR / SUBCLASS) it belongs to, so the subclass can be split out and
// each plug knows which item it targets. An unresolved hash means the instance isn't owned — left for
// equipGear / applyPlugs to report rather than thrown, so the rest of the build still applies.
async function resolveItem(
  profile: EquipBuildProfile,
  item: { itemId: string; plugs?: number[] },
): Promise<ResolvedItem> {
  const hash = itemHashFor(profile, item.itemId);
  const meta = hash === undefined ? undefined : await itemMeta(hash);

  return {
    itemId: item.itemId,
    hash,
    name: meta?.name ?? item.itemId,
    section: meta ? BUCKET[meta.bucketHash]?.section : undefined,
    plugs: item.plugs ?? [],
  };
}

async function equipSubclass(
  characterId: string,
  subclass: ResolvedItem,
): Promise<{ result: GearEquipResult; live: boolean }> {
  if (subclass.hash === undefined) {
    return {
      result: {
        itemId: subclass.itemId,
        name: subclass.name,
        status: "failed",
        reason: "not owned",
      },
      live: false,
    };
  }

  try {
    await action("/Destiny2/Actions/Items/EquipItem/", { characterId, itemId: subclass.itemId });

    return {
      result: { itemId: subclass.itemId, name: subclass.name, status: "equipped" },
      live: false,
    };
  } catch (error) {
    return {
      result: {
        itemId: subclass.itemId,
        name: subclass.name,
        status: "failed",
        reason: actionReason(error),
      },
      live: isNotInGame(error),
    };
  }
}

// Insert each of an item's target plugs into a distinct socket. Plugs aiming at a fragment socket go
// last (fragment sockets only enable once the aspects are in). A plug that resolves to no open socket
// is skipped (not unlocked / doesn't fit); a Bungie rejection is reported — neither stops the others.
async function applyPlugs(
  profile: EquipBuildProfile,
  characterId: string,
  item: ResolvedItem,
  hash: number,
  fragmentSockets: ReadonlySet<number>,
): Promise<PlugApplyResult[]> {
  const assignments = await assignPlugSockets(profile, item.itemId, hash, item.plugs);
  const ordered = [...assignments].sort(
    (a, b) => Number(isFragment(a, fragmentSockets)) - Number(isFragment(b, fragmentSockets)),
  );

  const results: PlugApplyResult[] = [];

  for (const { plugItemHash, socketIndex } of ordered) {
    const name = await itemName(plugItemHash);

    if (socketIndex === undefined) {
      results.push({
        plugItemHash,
        name,
        status: "skipped",
        reason: "not unlocked, or no open socket accepts it",
      });
      continue;
    }

    try {
      await action("/Destiny2/Actions/Items/InsertSocketPlugFree/", {
        plug: { socketIndex, socketArrayType: 0, plugItemHash },
        itemId: item.itemId,
        characterId,
      });
      results.push({ plugItemHash, name, status: "inserted" });
    } catch (error) {
      results.push({
        plugItemHash,
        name,
        status: "failed",
        reason: actionReason(error),
        live: isNotInGame(error),
      });
    }
  }

  return results;
}

function isFragment(assignment: PlugAssignment, fragmentSockets: ReadonlySet<number>): boolean {
  return assignment.socketIndex !== undefined && fragmentSockets.has(assignment.socketIndex);
}

// The socket indexes on a subclass that hold fragments, read from its definition's socket categories
// (the category whose name reads "… Fragments"). Used to order fragment inserts after aspect inserts.
async function fragmentSocketIndexes(itemHash: number): Promise<Set<number>> {
  const definition = await itemDefinition(itemHash);
  const indexes = new Set<number>();

  for (const category of definition.sockets?.socketCategories ?? []) {
    const name = await socketCategoryName(category.socketCategoryHash);

    if (name.toLowerCase().includes("fragment")) {
      for (const index of category.socketIndexes) {
        indexes.add(index);
      }
    }
  }

  return indexes;
}

function summarize(
  characterId: string,
  gear: GearEquipResult[],
  plugs: PlugGroup[],
  liveActionRequired: boolean,
): string {
  const gearOk = gear.filter((item) => item.status === "equipped").length;
  const plugTotal = plugs.reduce((sum, group) => sum + group.total, 0);
  const plugOk = plugs.reduce((sum, group) => sum + group.applied, 0);

  const live = liveActionRequired
    ? " Some equips need you signed into Destiny 2 — transfers and plug changes already applied; go in-game and re-run to finish the equips."
    : "";

  return `Equipped ${gearOk}/${gear.length} gear and set ${plugOk}/${plugTotal} plug(s) on character ${characterId}.${live}`;
}
