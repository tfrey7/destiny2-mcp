import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Component, getProfile } from "../bungie/profile.js";
import { suggestTriumphs } from "../bungie/progression.js";
import { json } from "./response.js";

export function registerSuggestTriumphs(server: McpServer): void {
  server.registerTool(
    "suggest_triumphs",
    {
      description:
        "Advise the player on which Triumphs to chase next, ranked over their live incomplete records. Ranking favors how close a Triumph is (live completion %), whether it's expiring, whether it feeds a title the player hasn't earned yet, and its Triumph score — so the top results are the highest-leverage things to do now. Optionally scope by location (a destination like 'Moon', 'Europa', 'Dreaming City') and/or activity (a kind like 'raid', 'dungeon', 'crucible', 'gambit') to answer 'what should I go after on the Moon'. Each suggestion carries a `why` (the ranking reasons), plus its location/activity/summary and per-objective progress. Note: many Triumphs (seasonal, account-wide, Moments of Triumph) aren't location-scoped, so a location filter narrows to the place-bound ones and returns a caveat. Read-only; reflects live account state — use get_triumphs for the seal overview and search_records to drill into a specific Triumph.",
      inputSchema: {
        location: z.string().optional(),
        activity: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (filters) => {
      const profile = await getProfile([Component.Records, Component.PresentationNodes]);

      return json(await suggestTriumphs(profile, filters));
    },
  );
}
