import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getTriumphsProfile } from "../bungie/profile.js";
import { searchRecords } from "../bungie/progression.js";
import { json } from "./response.js";

export function registerSearchRecords(server: McpServer): void {
  server.registerTool(
    "search_records",
    {
      description:
        "Search the player's Triumphs/Records (the manifest catalog joined with live completion). Filter by name substring, completion state (completed or incomplete), seal name (e.g. 'Conqueror'), location (a destination like 'Moon', 'Europa', 'Dreaming City', 'Neomuna'), and activity (a kind like 'raid', 'dungeon', 'crucible', 'gambit', 'strike'). Location/activity come from an enriched offline index — not every Triumph is location-scoped (seasonal, account-wide, and Moments-of-Triumph goals usually aren't), so those filters narrow to the ones that are. Each result reports its completion state, percent done, per-objective progress (with the in-game label, e.g. 'Enemies defeated 6/23'), the seal it belongs to, Triumph score, any reward items, and its location/activity/summary when known — so a caller can judge which Triumph is closest or most worth chasing. This reads live account state; don't answer Triumph questions from memory. Results cap at `limit` (default 25); `count` is the full match total and `truncated` flags more beyond the current page — pass `offset` to page through the rest. Obscured (locked) Triumphs report as Classified.",
      inputSchema: {
        name: z.string().optional(),
        state: z.enum(["completed", "incomplete"]).optional(),
        seal: z.string().optional(),
        location: z.string().optional(),
        activity: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (filters) => {
      const profile = await getTriumphsProfile();

      return json(await searchRecords(profile, filters));
    },
  );
}
