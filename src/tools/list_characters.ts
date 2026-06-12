import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClassType, Component, getProfile } from "../bungie/profile.js";
import { json } from "./response.js";

export function registerListCharacters(server: McpServer): void {
  server.registerTool(
    "list_characters",
    {
      description:
        "List the player's Destiny 2 characters with class, power level, and characterId.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const profile = await getProfile([Component.Characters]);
      const characters = Object.values(profile.characters?.data ?? {}).map((character) => ({
        characterId: character.characterId,
        class: ClassType[character.classType] ?? "Unknown",
        light: character.light,
        lastPlayed: character.dateLastPlayed,
      }));

      return json(characters);
    },
  );
}
