import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { itemName, loadoutName } from "../../bungie/manifest.js";
import { Component, getProfile } from "../../bungie/profile.js";
import { ownedInstanceByHash } from "./logic.js";
import { loadBuilds, type BuildRecipe, type DimItem } from "./recipes.js";

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
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

export function registerBuildTools(server: McpServer): void {
  server.registerTool(
    "find_builds",
    {
      description:
        "Search popular community Destiny 2 builds scraped from builders.gg (DIM loadouts). Optionally filter by class and subclass. Returns each build's gear plus a shareId to pass to import_build.",
      inputSchema: {
        className: z.enum(["Titan", "Hunter", "Warlock"]).optional(),
        subclass: z.enum(["Prismatic", "Solar", "Arc", "Void", "Stasis", "Strand"]).optional(),
      },
    },
    async ({ className, subclass }) => {
      const { builds, scrapedAt } = await loadBuilds();
      const filtered = builds.filter((b) => matches(b.className, className) && matches(b.subclass, subclass));

      const result = await Promise.all(
        filtered.map(async (build) => ({
          shareId: build.shareId,
          name: build.loadout.name,
          class: build.className,
          subclass: build.subclass,
          dimLink: build.dimLink,
          gear: await namesOf(build.loadout.equipped.filter((item) => !item.socketOverrides).map((item) => item.hash)),
        })),
      );
      return json({ scrapedAt, count: result.length, builds: result });
    },
  );

  server.registerTool(
    "import_build",
    {
      description:
        "Map a popular build (by shareId from find_builds) onto the gear you own. Reports which items you already have (with itemInstanceId for equip_items), which are missing, plus the subclass plugs and armor mods to set up manually. This is a plan — it does not change your gear.",
      inputSchema: { shareId: z.string() },
    },
    async ({ shareId }) => {
      const { builds } = await loadBuilds();
      const build = builds.find((b) => b.shareId === shareId);
      if (!build) return json({ error: `No build with shareId ${shareId}. Use find_builds to list them.` });

      const profile = await getProfile([
        Component.CharacterEquipment,
        Component.CharacterInventories,
        Component.ProfileInventories,
      ]);
      const owned = ownedInstanceByHash(profile);

      const gear = await Promise.all(
        build.loadout.equipped
          .filter((item) => !item.socketOverrides)
          .map(async (item) => ({
            name: await itemName(item.hash),
            owned: owned.has(item.hash),
            itemInstanceId: owned.get(item.hash),
          })),
      );

      const subclass = subclassItem(build);
      const subclassConfig = subclass
        ? {
            name: await itemName(subclass.hash),
            plugs: await namesOf(Object.values(subclass.socketOverrides ?? {})),
          }
        : undefined;

      const mods = await namesOf([...new Set(build.loadout.parameters?.mods ?? [])]);
      const nameHash = build.loadout.parameters?.inGameIdentifiers?.nameHash;

      return json({
        build: { name: build.loadout.name, class: build.className, subclass: build.subclass, dimLink: build.dimLink },
        suggestedLoadoutName: nameHash ? await loadoutName(nameHash) : undefined,
        equip: gear.filter((item) => item.owned),
        missing: gear.filter((item) => !item.owned).map((item) => item.name),
        subclass: subclassConfig,
        armorMods: mods,
        note: "Plan only. Equip the owned items with equip_items using their itemInstanceId; set the subclass plugs and armor mods manually in-game.",
      });
    },
  );
}
