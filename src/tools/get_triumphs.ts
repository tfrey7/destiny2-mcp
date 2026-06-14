import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getTriumphsProfile } from "../bungie/profile.js";
import { triumphSummary } from "../bungie/progression.js";
import { json } from "./response.js";

export function registerGetTriumphs(server: McpServer): void {
  server.registerTool(
    "get_triumphs",
    {
      description:
        "Summarize the player's Triumph standing: total Triumph score (active, legacy, lifetime) plus every seal (title) with its live completion counts and percent. Seals are sorted closest-to-done first, with earned titles last — so this is the source for 'which title should I focus on'. Use search_records to drill into the specific Triumphs inside a seal. Read-only; reflects live account state.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const profile = await getTriumphsProfile();

      return json(await triumphSummary(profile));
    },
  );
}
