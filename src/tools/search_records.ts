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
        "Search the player's Triumphs/Records (the manifest catalog joined with live completion). Filter by name substring, completion state (completed or incomplete), seal name (e.g. 'Conqueror'), location (a destination like 'Moon', 'Europa', 'Dreaming City', 'Neomuna'), activity (a kind like 'raid', 'dungeon', 'crucible', 'gambit', 'strike'), and source. Location/activity come from an enriched offline index — not every Triumph is location-scoped (seasonal, account-wide, and Moments-of-Triumph goals usually aren't), so those filters narrow to the ones that are. WEAPON PATTERNS: each craftable weapon has a 'Weapon Pattern' record whose live objective is its pattern progress (e.g. 'Pattern progress 5/5', completed once unlocked). These are the authoritative source for 'which patterns have I unlocked' — NOT the aggregate '<Raid> Patterns' Triumph, which does not track live progress and reads 0%. Pattern records carry a `source` field naming where the weapon drops ('Root of Nightmares Raid', 'Dungeon Duality', 'Season of the Witch'); pass `source` (case-insensitive substring) to list exactly the patterns from that raid/dungeon/season — e.g. source:'Root of Nightmares' returns its weapon patterns with each one's progress. Each result reports its completion state, percent done, per-objective progress (with the in-game label), the seal it belongs to, Triumph score, any reward items, and its location/activity/source/summary when known. This reads live account state; don't answer Triumph or pattern questions from memory. Results cap at `limit` (default 25); `count` is the full match total and `truncated` flags more beyond the current page — pass `offset` to page through the rest. Obscured (locked) Triumphs report as Classified.",
      inputSchema: {
        name: z.string().optional(),
        state: z.enum(["completed", "incomplete"]).optional(),
        seal: z.string().optional(),
        location: z.string().optional(),
        activity: z.string().optional(),
        source: z.string().optional(),
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
