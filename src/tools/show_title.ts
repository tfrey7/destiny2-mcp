import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { recordIcon, titleDetail, type TitleDetail } from "../bungie/progression.js";
import { Component, getProfile } from "../bungie/profile.js";
import { TITLE_UI_RESOURCE_URI } from "../format/title/index.js";
import { json, titleDetailCard } from "./response.js";
import { clientSupportsUi } from "./ui_capability.js";

export function registerShowTitle(server: McpServer): void {
  server.registerTool(
    "show_title",
    {
      description:
        "Show ONE title (Seal) in full as a detail card, styled like Destiny 2's in-game seal page: the gold emblem and title word, the unlock requirement, overall completion, and every member Triumph laid out inline (icon, name, score, live progress, objectives — no hover needed). Identify the title by its title word ('Dredgen'), its seal source ('Gambit'), or a seal hash. Use this when the player asks about a specific title or what's left to earn it; use show_titles for the gallery of all titles. Read-only; reflects live account state.",
      inputSchema: {
        title: z
          .string()
          .describe("The title word ('Dredgen'), the seal's source ('Gambit'), or a seal hash."),
      },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: TITLE_UI_RESOURCE_URI, visibility: ["model", "app"] } },
    },
    async ({ title }) => {
      const profile = await getProfile([Component.Records, Component.PresentationNodes]);
      const detail = await titleDetail(profile, title);

      if (!detail) {
        return json({
          error: `No available title matched "${title}". Use show_titles to see the titles you can earn, or pass a title word like "Dredgen" or a seal source like "Gambit".`,
        });
      }

      const icons = await resolveIcons(detail);

      // UI-capable hosts get the interactive detail card via structuredContent; the CLI falls
      // through to the text card.
      const ui = clientSupportsUi(server);

      return titleDetailCard({ detail, icons }, { ui });
    },
  );
}

// Resolve each member Triumph's manifest icon to a recordHash → CDN-path map. Only this one seal's
// records are looked up (a handful of point queries), keeping the data layer's JSON icon-free.
async function resolveIcons(detail: TitleDetail): Promise<Record<number, string>> {
  const entries = await Promise.all(
    detail.triumphs.map(
      async (triumph) => [triumph.recordHash, await recordIcon(triumph.recordHash)] as const,
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
