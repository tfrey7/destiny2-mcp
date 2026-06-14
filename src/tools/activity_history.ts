import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { activityHistory } from "../bungie/activities.js";
import { json } from "./response.js";

export function registerActivityHistory(server: McpServer): void {
  server.registerTool(
    "activity_history",
    {
      description:
        "List the player's recently-completed Destiny 2 activities, newest first, merged across all characters (or one, with characterId). Each entry resolves the activity's name, type, and destination from the manifest, plus its mode, start time, duration, kills/deaths/assists, KDR, whether it was completed, and PvP standing/score where they apply. Filter by mode with a human name — raid, dungeon, crucible, gambit, strike, nightfall, trials, story, patrol. Use this for the raw run-by-run list; use activity_recap for a rolled-up summary over a time window. Read-only; reflects live account state.",
      inputSchema: {
        mode: z.string().optional(),
        count: z.number().int().min(1).max(250).optional(),
        characterId: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (options) => json(await activityHistory(options)),
  );
}
