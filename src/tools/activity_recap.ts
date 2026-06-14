import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { activityRecap } from "../bungie/activities.js";
import { RECAP_UI_RESOURCE_URI } from "../format/recap/index.js";
import { recapCard } from "./response.js";
import { clientSupportsUi } from "./ui_capability.js";

export function registerActivityRecap(server: McpServer): void {
  server.registerTool(
    "activity_recap",
    {
      description:
        "Summarize the player's recent Destiny 2 activity over a time window as a dashboard card — the visual recap of what they played. Shows headline totals (activities, time played, overall KDR, clears), a by-mode breakdown, and notable runs (longest, best KDR), over the window's marquee activity art. Set the window with `period` ('today', 'yesterday', 'last 7 days', 'last week', 'last month') or explicit `start`/`end` dates; optionally filter to one mode (raid, dungeon, crucible, gambit, strike, nightfall, trials, story, patrol) and scope to one characterId. Lead with this card when the player asks how they've been doing or what they've played; use activity_history for the run-by-run list. Read-only; reflects live account state.",
      inputSchema: {
        period: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        mode: z.string().optional(),
        characterId: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: RECAP_UI_RESOURCE_URI, visibility: ["model", "app"] } },
    },
    async (options) => {
      const summary = await activityRecap(options);
      const spec = { title: "Activity Recap", summary };

      // UI-capable hosts get the interactive dashboard via structuredContent; the CLI falls through
      // to the text card.
      return recapCard(spec, { ui: clientSupportsUi(server) });
    },
  );
}
