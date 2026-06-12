import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { itemMeta, type ItemMeta } from "../bungie/manifest.js";
import { ClassType, Component, type DestinyCharacter, getProfile } from "../bungie/profile.js";
import { card, json } from "./response.js";

export function registerShowEquipped(server: McpServer): void {
  server.registerTool(
    "show_equipped",
    {
      description:
        "Render the currently equipped gear as a text card: weapons, armor, and subclass in aligned columns, with exotics marked and elements named. Defaults to the most recently played character; pass a characterId to choose another. Use this to show a player their current loadout.",
      inputSchema: { characterId: z.string().optional() },
    },
    async ({ characterId }) => {
      const profile = await getProfile([Component.Characters, Component.CharacterEquipment]);
      const equipment = profile.characterEquipment?.data ?? {};

      const id =
        characterId ??
        mostRecentlyPlayed(profile.characters?.data ?? {})?.characterId ??
        Object.keys(equipment)[0];
      const bucket = id ? equipment[id] : undefined;

      if (!bucket) {
        return json({ error: `No equipped gear for character ${id}` });
      }

      const items = (await Promise.all(bucket.items.map((item) => itemMeta(item.itemHash)))).filter(
        (item): item is ItemMeta => item !== undefined,
      );

      return card({
        title: "EQUIPPED",
        className: ClassType[profile.characters?.data?.[id]?.classType ?? -1] ?? "Unknown",
        subtitle: "current",
        items,
      });
    },
  );
}

function mostRecentlyPlayed(
  characters: Record<string, DestinyCharacter>,
): DestinyCharacter | undefined {
  return Object.values(characters).reduce<DestinyCharacter | undefined>(
    (latest, character) =>
      character.dateLastPlayed > (latest?.dateLastPlayed ?? "") ? character : latest,
    undefined,
  );
}
