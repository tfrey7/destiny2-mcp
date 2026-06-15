import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  describePlugs,
  intrinsicPerks,
  itemMeta,
  itemName,
  loadoutName,
  type ItemMeta,
} from "../../bungie/manifest.js";
import {
  ClassType,
  Component,
  type DestinyCharacter,
  getProfile,
  type ProfileFor,
} from "../../bungie/profile.js";
import { classNameSchema, subclassSchema } from "../../schemas.js";
import { renderLoadoutCardText } from "../../format/loadout/index.js";
import { BUCKET, type Section } from "../../format/loadout/data.js";
import { ownedItemsByHash, type OwnedItem } from "./logic.js";
import { loadBuilds, type BuildRecipe, type DimItem } from "./recipes.js";

export function registerBuildTools(server: McpServer): void {
  server.registerTool(
    "find_builds",
    {
      description:
        "Search popular community Destiny 2 builds scraped from builders.gg (DIM loadouts). Optionally filter by class and subclass. Renders each build as a text loadout card, plus a shareId index to pass to import_build.",
      inputSchema: {
        className: classNameSchema.optional(),
        subclass: subclassSchema.optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ className, subclass }) => {
      const { builds, scrapedAt } = await loadBuilds();
      const filtered = builds.filter(
        (b) => matches(b.className, className) && matches(b.subclass, subclass),
      );

      const cards = await Promise.all(filtered.map(buildCard));
      const index = filtered.map((build) => ({
        shareId: build.shareId,
        name: build.loadout.name,
        class: build.className,
        subclass: build.subclass,
        dimLink: build.dimLink,
      }));

      return cardsAndJson(cards, { scrapedAt, count: index.length, builds: index });
    },
  );

  server.registerTool(
    "import_build",
    {
      description:
        "Map a popular build (by shareId from find_builds) onto the gear you own. Renders the build as a text loadout card, then reports which items you already have (with itemInstanceId for equip_items), which are missing, and the armor mods to set up manually. The subclass abilities/aspects/fragments and each exotic come with their in-game rules text — the mechanical atoms to reason out how the build actually plays (its loop, opener, and priorities) against the verbs and method in get_build_knowledge. This is a plan — it does not change your gear.",
      inputSchema: { shareId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ shareId }) => {
      const { builds } = await loadBuilds();
      const build = builds.find((b) => b.shareId === shareId);

      if (!build) {
        return json({ error: `No build with shareId ${shareId}. Use find_builds to list them.` });
      }

      const profile = await getProfile([
        Component.CharacterEquipment,
        Component.CharacterInventories,
        Component.ProfileInventories,
      ]);
      const ownedByHash = ownedItemsByHash(profile);

      const gear = await Promise.all(
        build.loadout.equipped
          .filter((item) => !item.socketOverrides)
          .map(async (item) => {
            const owned = ownedByHash.get(item.hash);

            return {
              name: await itemName(item.hash),
              owned: owned !== undefined,
              itemInstanceId: owned?.itemInstanceId,
              location: owned?.location,
              characterId: owned?.characterId,
            };
          }),
      );

      const subclass = subclassItem(build);
      const subclassConfig = subclass
        ? {
            name: await itemName(subclass.hash),
            // Abilities, aspects, and fragments with their rules text — the verbs this build
            // generates and amplifies, which is what its loop is reasoned from.
            plugs: withRules(await describePlugs(Object.values(subclass.socketOverrides ?? {}))),
          }
        : undefined;

      const exotics = await exoticPerks(build.loadout.equipped.map((item) => item.hash));

      const mods = await namesOf([...new Set(build.loadout.parameters?.mods ?? [])]);
      const nameHash = build.loadout.parameters?.inGameIdentifiers?.nameHash;

      return cardsAndJson([await buildCard(build)], {
        build: {
          name: build.loadout.name,
          class: build.className,
          subclass: build.subclass,
          dimLink: build.dimLink,
        },
        suggestedLoadoutName: nameHash ? await loadoutName(nameHash) : undefined,
        equip: gear
          .filter((item) => item.owned)
          .map(({ name, itemInstanceId, location, characterId }) => ({
            name,
            itemInstanceId,
            location,
            characterId,
          })),
        missing: gear.filter((item) => !item.owned).map((item) => item.name),
        subclass: subclassConfig,
        // The exotic is the build's multiplier — its perk text is the atom that turns a fair loop
        // into the oppressive one, so surface it for reasoning rather than leaving it to a lookup.
        exotics,
        armorMods: mods,
        note: "Plan only. equip_items only accepts gear the target character already holds: items with location 'vault' (or 'equipped'/'inventory' on a different characterId) must first be pulled to that character with transfer_item — cross-character moves go via the vault, so two transfers. Set the subclass plugs and armor mods manually in-game.",
      });
    },
  );

  server.registerTool(
    "recommend_loadout",
    {
      description:
        "Recommend a COMPLETE, ready-to-run loadout for a class + subclass (plus an optional theme) in " +
        'ONE call — the high-level entry point for "what should I run" / "recommend me a loadout", so ' +
        "you don't hand-orchestrate search_items / god_roll / show_build. It selects a curated community " +
        "build matching the seed (no find_builds → import_build round-trip), maps it onto the gear you " +
        "own, and returns the FINISHED build: a loadout card, the subclass with its aspects/fragments as " +
        "plug hashes, all three weapons, all five armor pieces, the build's functional armor mods, and " +
        "which pieces you already own (with instance ids) vs. still need. Lead your answer with the card. " +
        "The `equip` block is ready to hand to equip_build — it equips the owned gear and sets the " +
        "subclass (super/abilities/aspects/fragments) in one call. Armor mods are listed separately in " +
        "`mods` — they're slot-specific (the mod's type names its slot) and fit a fixed 10-energy budget " +
        "per piece; they are part of the build and never optional, so always relay them (this tool lists " +
        "them but doesn't yet auto-insert them per piece). Coverage " +
        "is bounded by the community build library (currently Warlock-heavy); when " +
        "nothing matches the seed it says so and points you to find_builds or " +
        "get_build_knowledge('recommending'). Read-only; changes nothing.",
      inputSchema: {
        className: classNameSchema
          .optional()
          .describe("Defaults to your most recently played character's class."),
        subclass: subclassSchema
          .optional()
          .describe("e.g. Void, Prismatic. Omit to take the top build for the class."),
        query: z
          .string()
          .optional()
          .describe(
            "Optional theme/keyword matched against the build name (e.g. an exotic or playstyle).",
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ className, subclass, query }) => {
      const { builds } = await loadBuilds();
      const profile = await getProfile(RECOMMEND_COMPONENTS);
      const recent = mostRecentCharacter(profile);
      const cls = className ?? (recent ? ClassType[recent.classType] : undefined);

      const candidates = builds.filter(
        (build) =>
          matches(build.className, cls) &&
          matches(build.subclass, subclass) &&
          matchesQuery(build, query),
      );

      if (candidates.length === 0) {
        return json({
          recommendation: null,
          reason:
            `No curated community build matches ${cls ?? "that class"}` +
            `${subclass ? ` / ${subclass}` : ""}${query ? ` ("${query}")` : ""}. ` +
            "The build library is community-scraped — browse everything with find_builds, or build " +
            "from scratch following get_build_knowledge('recommending').",
          libraryCoverage: coverageSummary(builds),
        });
      }

      const [chosen, ...rest] = candidates;
      const spec = await personalize(chosen, profile, recent?.id);

      return cardsAndJson([await buildCard(chosen)], {
        recommendation: {
          name: chosen.loadout.name,
          class: chosen.className,
          subclass: chosen.subclass,
          shareId: chosen.shareId,
          dimLink: chosen.dimLink,
        },
        ...spec,
        alternatives: rest.map((build) => ({
          shareId: build.shareId,
          name: build.loadout.name,
          subclass: build.subclass,
        })),
        note:
          "Lead with the card. To equip: hand `equip.suggestedCharacterId` + `equip.items` to " +
          "equip_build (owned gear + the subclass with its plug hashes); confirm the target character " +
          "first. The build's armor mods are in `mods` — relay them and apply each to its slot (the mod's " +
          "type names the slot; each piece holds up to 10 energy of mods). They aren't auto-inserted " +
          "here. Pieces in " +
          "`missing` must be farmed first (how_to_acquire). Equipping needs you signed into Destiny 2; " +
          "transfers and plug inserts work offline.",
      });
    },
  );
}

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

type TextBlock = { type: "text"; text: string };

/** One or more text cards followed by the structured payload, so builds read at a glance but stay actionable. */
function cardsAndJson(cards: TextBlock[], value: unknown) {
  return { content: [...cards, { type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

/** Render a community build's gear (weapons, armor, and subclass) as a loadout text card. */
async function buildCard(build: BuildRecipe): Promise<TextBlock> {
  const items = (
    await Promise.all(build.loadout.equipped.map((item) => itemMeta(item.hash)))
  ).filter((meta): meta is ItemMeta => meta !== undefined);

  return {
    type: "text",
    text: renderLoadoutCardText({
      title: build.loadout.name.toUpperCase(),
      className: build.className,
      subtitle: build.subclass,
      items,
    }),
  };
}

function matches(value: string, filter?: string): boolean {
  return !filter || value.toLowerCase() === filter.toLowerCase();
}

async function namesOf(hashes: number[]): Promise<string[]> {
  return Promise.all(hashes.map((hash) => itemName(hash)));
}

function subclassItem(build: BuildRecipe): DimItem | undefined {
  return build.loadout.equipped.find((item) => item.socketOverrides);
}

// Keep only plugs that actually carry rules text — drops empty ability/fragment sockets, whose names
// are noise, so what's left is the mechanical atoms worth reasoning from. Generic so the plug's hash
// (which show_build needs to render a subclass tile) survives the filter.
function withRules<T extends { description: string }>(plugs: T[]): T[] {
  return plugs.filter((plug) => plug.description);
}

// The exotic perks among a build's equipped gear, each as name + rules text. An exotic is the loop's
// multiplier, so its mechanic is surfaced inline; legendaries carry no build-defining intrinsic, so
// they're skipped.
async function exoticPerks(hashes: number[]): Promise<ExoticPerk[]> {
  const resolved = await Promise.all(
    hashes.map(async (hash): Promise<ExoticPerk | undefined> => {
      const meta = await itemMeta(hash);

      if (meta?.rarity !== "Exotic") {
        return undefined;
      }

      return { name: meta.name, perks: withRules(await intrinsicPerks(hash)) };
    }),
  );

  return resolved.filter((exotic): exotic is ExoticPerk => exotic !== undefined);
}

interface ExoticPerk {
  name: string;
  perks: { hash: number; name: string; description: string }[];
}

const RECOMMEND_COMPONENTS = [
  Component.Characters,
  Component.CharacterEquipment,
  Component.CharacterInventories,
  Component.ProfileInventories,
] as const;

type RecommendProfile = ProfileFor<typeof RECOMMEND_COMPONENTS>;

interface ResolvedPiece {
  name: string;
  hash: number;
  section?: Section;
  slot?: string;
  owned: boolean;
  itemInstanceId?: string;
  location?: string;
  characterId?: string;
}

// Map one curated build onto the gear the account owns: split its equipped items into weapons/armor,
// resolve the subclass plugs, list the build's functional armor mods, and assemble an equip-ready item
// list. The gear + subclass (with its aspects/fragments) are equip_build-ready; the armor mods are
// surfaced for the player to apply (each is slot-specific — its type names its slot — and not yet
// auto-inserted to its piece here).
async function personalize(
  build: BuildRecipe,
  profile: RecommendProfile,
  suggestedCharacterId?: string,
) {
  const ownedByHash = ownedItemsByHash(profile);
  const subclass = subclassItem(build);

  const pieces = await Promise.all(
    build.loadout.equipped
      .filter((item) => item !== subclass)
      .map((item) => resolvePiece(item, ownedByHash)),
  );

  const subclassConfig = subclass ? await resolveSubclass(subclass, ownedByHash) : undefined;
  const exotics = await exoticPerks(build.loadout.equipped.map((item) => item.hash));
  const mods = await functionalMods(build);

  const missing = pieces.filter((piece) => !piece.owned).map((piece) => piece.name);

  if (subclassConfig && !subclassConfig.owned) {
    missing.push(subclassConfig.name);
  }

  // Gear equips by instance; the subclass also carries its full plug set (super/abilities/aspects/
  // fragments), so equip_build sets the subclass in the same call. Armor mods are NOT attached per piece
  // here — they're listed in `mods` (slot-specific, applied to their own slot) for the player to apply.
  const equipItems = [
    ...pieces
      .filter((piece) => piece.owned)
      .map((piece) => ({ itemId: piece.itemInstanceId, name: piece.name })),
    ...(subclassConfig?.owned
      ? [
          {
            itemId: subclassConfig.itemInstanceId,
            name: subclassConfig.name,
            plugs: subclassConfig.plugHashes,
          },
        ]
      : []),
  ];

  return {
    weapons: pieces.filter((piece) => piece.section === "WEAPONS").map(publicPiece),
    armor: pieces.filter((piece) => piece.section === "ARMOR").map(publicPiece),
    subclass: subclassConfig
      ? {
          name: subclassConfig.name,
          hash: subclassConfig.hash,
          owned: subclassConfig.owned,
          plugs: subclassConfig.plugs,
        }
      : undefined,
    exotics,
    mods,
    missing,
    equip: { suggestedCharacterId, items: equipItems },
  };
}

async function resolvePiece(
  item: DimItem,
  ownedByHash: Map<number, OwnedItem>,
): Promise<ResolvedPiece> {
  const meta = await itemMeta(item.hash);
  const bucket = meta ? BUCKET[meta.bucketHash] : undefined;
  const owned = ownedByHash.get(item.hash);

  return {
    name: meta?.name ?? String(item.hash),
    hash: item.hash,
    section: bucket?.section,
    slot: bucket?.label,
    owned: owned !== undefined,
    itemInstanceId: owned?.itemInstanceId,
    location: owned?.location,
    characterId: owned?.characterId,
  };
}

async function resolveSubclass(subclass: DimItem, ownedByHash: Map<number, OwnedItem>) {
  const owned = ownedByHash.get(subclass.hash);
  const plugHashes = Object.values(subclass.socketOverrides ?? {});

  return {
    name: await itemName(subclass.hash),
    hash: subclass.hash,
    owned: owned !== undefined,
    itemInstanceId: owned?.itemInstanceId,
    // Abilities/aspects/fragments with rules text for display; the raw hashes for equipping.
    plugs: withRules(await describePlugs(plugHashes)),
    plugHashes,
  };
}

// The build's functional armor mods. These live in the flat parameters.mods list (NOT modsByBucket,
// which holds the build's cosmetics — shaders/ornaments). Each mod is slot-specific (its itemTypeDisplayName
// names the slot) and costs energy against a fixed per-piece budget of 10; this lists the build's mods
// without assigning them to pieces. Duplicates are meaningful (the build lists the same mod more than
// once), so they're collapsed to a count rather than dropped.
async function functionalMods(
  build: BuildRecipe,
): Promise<{ hash: number; name: string; count: number }[]> {
  const counts = new Map<number, number>();

  for (const hash of build.loadout.parameters?.mods ?? []) {
    counts.set(hash, (counts.get(hash) ?? 0) + 1);
  }

  return Promise.all(
    [...counts].map(async ([hash, count]) => ({ hash, name: await itemName(hash), count })),
  );
}

// Drop the internal section tag before the piece goes in the result; slot carries the human label.
function publicPiece({ section: _section, ...rest }: ResolvedPiece) {
  return rest;
}

function matchesQuery(build: BuildRecipe, query?: string): boolean {
  if (!query) {
    return true;
  }

  const needle = query.toLowerCase();

  return (
    build.loadout.name.toLowerCase().includes(needle) ||
    build.slug.toLowerCase().includes(needle) ||
    build.subclass.toLowerCase().includes(needle)
  );
}

function mostRecentCharacter(
  profile: RecommendProfile,
): { id: string; classType: number } | undefined {
  let best: { id: string; classType: number; date: string } | undefined;

  for (const [id, character] of Object.entries(profile.characters) as [
    string,
    DestinyCharacter,
  ][]) {
    if (!best || character.dateLastPlayed > best.date) {
      best = { id, classType: character.classType, date: character.dateLastPlayed };
    }
  }

  return best ? { id: best.id, classType: best.classType } : undefined;
}

function coverageSummary(builds: BuildRecipe[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const build of builds) {
    const key = `${build.className} / ${build.subclass}`;

    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}
