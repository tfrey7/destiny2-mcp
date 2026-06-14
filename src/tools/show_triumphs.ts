import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  recordIcon,
  recordRewards,
  suggestTriumphs,
  type RecordReward,
  type TriumphSuggestion,
} from "../bungie/progression.js";
import { Component, getProfile } from "../bungie/profile.js";
import { TRIUMPHS_UI_RESOURCE_URI } from "../format/triumphs/index.js";
import { triumphCard } from "./response.js";
import { clientSupportsUi } from "./ui_capability.js";

export function registerShowTriumphs(server: McpServer): void {
  server.registerTool(
    "show_triumphs",
    {
      description:
        "Show the Triumphs worth chasing next as an interactive tile grid — the visual form of the suggest_triumphs advisor, styled like Destiny 2's in-game Triumphs screen. Each tile shows the Triumph's icon, score, completion bar, and name; hovering a tile reveals its description, per-objective progress, the reasons it's worth chasing, and its seal/location/activity. Takes the same filters as suggest_triumphs — scope by location (a destination like 'Moon', 'Europa') and/or activity (a kind like 'raid', 'dungeon', 'crucible') — and ranks over the player's live incomplete records. Lead with this card when the player asks what to go after; use suggest_triumphs when you need the ranking data in text. Read-only; reflects live account state.",
      inputSchema: {
        location: z.string().optional(),
        activity: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: TRIUMPHS_UI_RESOURCE_URI, visibility: ["model", "app"] } },
    },
    async (filters) => {
      const profile = await getProfile([Component.Records, Component.PresentationNodes]);
      const result = await suggestTriumphs(profile, filters);

      const [icons, rewards] = await Promise.all([
        resolveIcons(result.suggestions),
        resolveRewards(result.suggestions),
      ]);

      const spec = {
        title: "Triumphs to Chase",
        subtitle: subtitle(result.count, result.location, result.activity),
        ...(result.caveat ? { caveat: result.caveat } : {}),
        suggestions: result.suggestions,
        icons,
        rewards,
      };

      // UI-capable hosts get the interactive grid via structuredContent; the CLI falls through to
      // the text card.
      const ui = clientSupportsUi(server);

      return triumphCard(spec, { ui });
    },
  );
}

// "15 ranked · Moon · raid" — the count of matching incomplete Triumphs, then any active scope.
function subtitle(count: number, location?: string, activity?: string): string {
  const scope = [location, activity].filter(Boolean).join(" · ");

  return scope ? `${count} ranked · ${scope}` : `${count} ranked`;
}

// Resolve each shown Triumph's manifest icon to a recordHash → CDN-path map. Only the suggestions
// being rendered are looked up (a handful of point queries), keeping the advisor's JSON icon-free.
async function resolveIcons(suggestions: TriumphSuggestion[]): Promise<Record<number, string>> {
  const entries = await Promise.all(
    suggestions.map(
      async (suggestion) =>
        [suggestion.recordHash, await recordIcon(suggestion.recordHash)] as const,
    ),
  );

  const icons: Record<number, string> = {};

  for (const [hash, icon] of entries) {
    if (icon) {
      icons[hash] = icon;
    }
  }

  return icons;
}

// Resolve each shown Triumph's reward items (name + icon) to a recordHash → rewards map. Only the
// rendered suggestions are looked up, and Triumphs with no rewards are omitted.
async function resolveRewards(
  suggestions: TriumphSuggestion[],
): Promise<Record<number, RecordReward[]>> {
  const entries = await Promise.all(
    suggestions.map(
      async (suggestion) =>
        [suggestion.recordHash, await recordRewards(suggestion.recordHash)] as const,
    ),
  );

  const rewards: Record<number, RecordReward[]> = {};

  for (const [hash, items] of entries) {
    if (items.length > 0) {
      rewards[hash] = items;
    }
  }

  return rewards;
}
