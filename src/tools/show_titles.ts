import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { titleGallery } from "../bungie/progression.js";
import { Component, getProfile } from "../bungie/profile.js";
import { TITLES_UI_RESOURCE_URI } from "../format/titles/index.js";
import { titleCard } from "./response.js";
import { clientSupportsUi } from "./ui_capability.js";

export function registerShowTitles(server: McpServer): void {
  server.registerTool(
    "show_titles",
    {
      description:
        "Show the player's Titles (Seals) as an interactive gallery, styled like Destiny 2's in-game Seals screen. Every currently-available title is a crest tile led by its seal emblem and the earned title word; earned titles glow gold (gilded ones show their laurel count), in-progress titles take an amber accent, and untouched ones are dimmed. Hovering a tile reveals the unlock requirement and the exact Triumph tally. Earned titles sort first, then closest-to-done. Lead with this card when the player asks about titles, seals, or what title to chase next; use get_triumphs for the seal standing as text, or search_records(seal:) to drill into the specific Triumphs a seal needs. Read-only; reflects live account state.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: TITLES_UI_RESOURCE_URI, visibility: ["model", "app"] } },
    },
    async () => {
      const profile = await getProfile([Component.Records, Component.PresentationNodes]);
      const gallery = await titleGallery(profile);

      const spec = {
        title: "Titles",
        subtitle: subtitle(gallery.earned, gallery.total, gallery.score.total),
        titles: gallery.titles,
      };

      // UI-capable hosts get the interactive gallery via structuredContent; the CLI falls through to
      // the text card.
      const ui = clientSupportsUi(server);

      return titleCard(spec, { ui });
    },
  );
}

// "3 of 42 earned · 13,865 Triumph score" — how many titles are held, then the running Triumph score.
function subtitle(earned: number, total: number, score: number): string {
  return `${earned} of ${total} earned · ${score.toLocaleString("en-US")} Triumph score`;
}
