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
import { Component, getProfile } from "../../bungie/profile.js";
import { classNameSchema, subclassSchema } from "../../schemas.js";
import { renderLoadoutCardText } from "../../format/loadout/index.js";
import { ownedItemsByHash } from "./logic.js";
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
// are noise, so what's left is the mechanical atoms worth reasoning from.
function withRules(plugs: { name: string; description: string }[]) {
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
  perks: { name: string; description: string }[];
}
