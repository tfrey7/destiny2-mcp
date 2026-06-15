import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { collectedCollectibles } from "../bungie/acquisition.js";
import { itemInfo, itemMeta } from "../bungie/manifest.js";
import { displayPlugs, plugViewsFromHashes, type PlugView } from "../bungie/plugs.js";
import {
  ClassType,
  Component,
  type DestinyCharacter,
  getProfile,
  type ProfileFor,
} from "../bungie/profile.js";
import { BUCKET, type Section } from "../format/loadout/data.js";
import { LOADOUT_UI_RESOURCE_URI } from "../format/loadout/html.js";
import type { LoadoutCard, LoadoutCardItem } from "../format/loadout/model.js";
import { classNameSchema } from "../schemas.js";
import { ownedItemsByHash, type OwnedItem } from "./builds/logic.js";
import { card, json } from "./response.js";
import { clientSupportsUi } from "./ui_capability.js";

const itemSchema = z.object({
  hash: z
    .number()
    .describe(
      "The item's manifest hash — from search_items (itemHash) or inspect_item. A weapon, armor piece, or subclass.",
    ),
  plugs: z
    .array(z.number())
    .optional()
    .describe(
      "Target plug hashes in display order — weapon perks, armor mods, or subclass aspects + fragments. Source them from inspect_sockets (plugItemHash), search_items with category 'perk' (itemHash), or a build's subclass socketOverrides from import_build. Omit to show a held copy's real rolled plugs (or the item's defaults).",
    ),
  owned: z
    .boolean()
    .optional()
    .describe(
      "Marks the piece owned (✓) or still-to-farm (⚒). Omit to auto-detect from held gear; set false (e.g. from search_items owned=false) to flag a piece the player must still acquire.",
    ),
});

export function registerShowBuild(server: McpServer): void {
  server.registerTool(
    "show_build",
    {
      description:
        "Render ANY set of items as a loadout card — a proposed or target build, not necessarily owned or equipped. This is how you SHOW a build recommendation, and a recommendation should ALWAYS lead with this card, not prose. Pass the COMPLETE end-state: the subclass (with its aspects/fragments as plug hashes), all three weapons, and all five armor pieces — each with its target perk/mod plug hashes — so the card draws them like a real loadout, marking each piece owned (✓) vs. still-to-farm (⚒). Fill every slot: never leave a weapon slot out as \"bring whatever\" or a socket empty — a partial card is not a build. The card IS the answer — follow it only with a short list of what the changes buy and where to acquire the needed pieces (how_to_acquire), and don't restate the card's contents in prose. Read-only; changes nothing.",
      inputSchema: {
        title: z.string().describe("Build name, shown as the card heading."),
        subtitle: z
          .string()
          .optional()
          .describe(
            "Detail after the class name, e.g. the subclass and engine ('Strand · suspend').",
          ),
        className: classNameSchema
          .optional()
          .describe("Defaults to the most recently played character's class, then 'Guardian'."),
        items: z
          .array(itemSchema)
          .describe("The weapons, armor, and subclass that make up the build."),
      },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: LOADOUT_UI_RESOURCE_URI, visibility: ["model", "app"] } },
    },
    async ({ title, subtitle, className, items }) => {
      // Ownership and live rolls are best-effort enrichment: a logged-out (or failed) fetch yields
      // null, so the build still renders — just without owned markers or real held rolls.
      const profile = await tryProfile();
      const owned = profile ? ownedItemsByHash(profile) : new Map<number, OwnedItem>();
      // Collections lets a piece the account owns but isn't holding (a Deluxe-edition exotic, a
      // dismantled raid drop) still read as owned. The data is absent when logged out / the fetch
      // failed; pass undefined then so a not-held piece stays unmarked rather than flagging to farm.
      const acquired = collectionsAcquired(profile);

      const resolved = (
        await Promise.all(items.map((item) => resolveItem(item, owned, acquired, profile)))
      ).filter((item): item is LoadoutCardItem => item !== undefined);

      if (resolved.length === 0) {
        return json({ error: "None of the given item hashes resolved against the manifest." });
      }

      const spec: LoadoutCard = {
        title: title.toUpperCase(),
        className: className ?? recentClass(profile) ?? "Guardian",
        subtitle,
        items: resolved,
      };

      // UI-capable hosts get the interactive card via structuredContent; the CLI falls through to the
      // text card. There's no live loadout to re-equip, so the card is visual-only (no action button).
      const ui = clientSupportsUi(server) ? {} : undefined;

      return card(spec, { ui });
    },
  );
}

// The tri-state owned marker, mirroring search_items so the two tools can't disagree about what
// "owned" means: an explicit flag wins; a held copy or an acquired collectible reads owned (✓); a
// trackable item the account never acquired reads to-farm (⚒); and an item with no collectible — or
// no Collections data to consult — stays unmarked, since absence of a collectible is not proof the
// account lacks it.
export async function ownershipMarker(
  item: { hash: number; owned?: boolean },
  held: boolean,
  acquired: Set<number> | undefined,
): Promise<boolean | undefined> {
  if (item.owned !== undefined) {
    return item.owned;
  }

  if (held) {
    return true;
  }

  if (!acquired) {
    return undefined;
  }

  const collectibleHash = (await itemInfo(item.hash))?.collectibleHash;

  return collectibleHash === undefined ? undefined : acquired.has(collectibleHash);
}

async function resolveItem(
  item: z.infer<typeof itemSchema>,
  owned: Map<number, OwnedItem>,
  acquired: Set<number> | undefined,
  profile: ShowBuildProfile | null,
): Promise<LoadoutCardItem | undefined> {
  const meta = await itemMeta(item.hash);

  if (!meta) {
    return undefined;
  }

  const section = BUCKET[meta.bucketHash]?.section as Section | undefined;
  const held = owned.get(item.hash);
  const plugs = await resolvePlugs(item, section, held, profile);
  const isOwned = await ownershipMarker(item, held !== undefined, acquired);

  return { ...meta, hash: item.hash, plugs, owned: isOwned };
}

async function resolvePlugs(
  item: z.infer<typeof itemSchema>,
  section: Section | undefined,
  held: OwnedItem | undefined,
  profile: ShowBuildProfile | null,
): Promise<PlugView[] | undefined> {
  if (!section) {
    return undefined;
  }

  // A named target roll for gear the player may not own; else the held copy's live plugs, falling
  // back to the item's manifest defaults when there's no instance to read (displayPlugs handles both).
  if (item.plugs?.length) {
    return plugViewsFromHashes(item.plugs, section);
  }

  return displayPlugs(item.hash, held?.itemInstanceId, profile?.itemSockets ?? {}, section);
}

const SHOW_BUILD_COMPONENTS = [
  Component.Characters,
  Component.CharacterEquipment,
  Component.CharacterInventories,
  Component.ProfileInventories,
  Component.ItemSockets,
  Component.Collectibles,
] as const;

type ShowBuildProfile = ProfileFor<typeof SHOW_BUILD_COMPONENTS>;

// Ownership and live rolls are best-effort: a logged-out or failed fetch yields null, and the build
// still renders — just without owned markers or real held rolls.
async function tryProfile(): Promise<ShowBuildProfile | null> {
  try {
    return await getProfile(SHOW_BUILD_COMPONENTS);
  } catch {
    return null;
  }
}

// The set of collectibles the account has acquired, or undefined when the profile carries no
// Collections data (logged out / the fetch failed) — distinguishing "this isn't acquired" from
// "we have nothing to check against", so the latter leaves a piece unmarked instead of to-farm.
function collectionsAcquired(profile: ShowBuildProfile | null): Set<number> | undefined {
  return profile ? collectedCollectibles(profile) : undefined;
}

function recentClass(profile: ShowBuildProfile | null): string | undefined {
  const recent = Object.values(profile?.characters ?? {}).reduce<DestinyCharacter | undefined>(
    (latest, character) =>
      character.dateLastPlayed > (latest?.dateLastPlayed ?? "") ? character : latest,
    undefined,
  );

  return recent ? ClassType[recent.classType] : undefined;
}
