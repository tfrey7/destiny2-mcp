import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Component, getProfile } from "../bungie/profile.js";
import { activeQuests } from "./quests.js";
import { json } from "./response.js";

export function registerListActiveQuests(server: McpServer): void {
  server.registerTool(
    "list_active_quests",
    {
      description:
        "List the quest steps a player is actively working, across all characters. Each quest reports its current step name, the quest line and step position (e.g. '3 of 11'), per-objective progress with the in-game label, overall percent complete, and the reward items for finishing the step — so a caller can judge which quest is closest or most rewarding to finish. There is no durable 'completed quests' list in Destiny; this surfaces in-progress steps only (finished quests leave the inventory and back into a Triumph — use search_records for those). Read-only; reflects live account state.",
      inputSchema: { characterId: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ characterId }) => {
      const profile = await getProfile([
        Component.Characters,
        Component.CharacterInventories,
        Component.ItemObjectives,
      ]);
      const quests = await activeQuests(profile);

      return json(
        characterId ? quests.filter((quest) => quest.characterId === characterId) : quests,
      );
    },
  );
}
