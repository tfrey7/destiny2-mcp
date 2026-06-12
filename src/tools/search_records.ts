import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProfile, Component } from "../bungie/profile.js";
import { searchRecords } from "../bungie/progression.js";
import { json } from "./response.js";

export function registerSearchRecords(server: McpServer): void {
  server.registerTool(
    "search_records",
    {
      description:
        "Search the player's Triumphs/Records (the manifest catalog joined with live completion). Filter by name substring, completion state (completed or incomplete), and seal name (e.g. 'Conqueror'). Each result reports its completion state, percent done, per-objective progress (with the in-game label, e.g. 'Enemies defeated 6/23'), the seal it belongs to, Triumph score, and any reward items — so a caller can judge which Triumph is closest or most worth chasing. This reads live account state; don't answer Triumph questions from memory. Results cap at `limit` (default 25) with a `truncated` flag; obscured (locked) Triumphs report as Classified.",
      inputSchema: {
        name: z.string().optional(),
        state: z.enum(["completed", "incomplete"]).optional(),
        seal: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (filters) => {
      const profile = await getProfile([Component.Records, Component.PresentationNodes]);

      return json(await searchRecords(profile, filters));
    },
  );
}
