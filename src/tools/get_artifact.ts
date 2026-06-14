import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getArtifactProfile } from "../bungie/profile.js";
import { describeArtifact, seasonalArtifact } from "./artifact.js";
import { json } from "./response.js";

export function registerGetArtifact(server: McpServer): void {
  server.registerTool(
    "get_artifact",
    {
      description:
        "Report the player's active seasonal artifact: its name, points spent, and every perk grouped by tier — each marked as chosen or not — with current in-game descriptions. This is the source of truth for which artifact perks (anti-champion mods and build bonuses) are currently active. Read-only: the artifact and its perks are chosen in-game and can't be set through the API.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const profile = await getArtifactProfile();
      const artifact = seasonalArtifact(profile);

      if (!artifact) {
        return json({ error: "No seasonal artifact found on this account." });
      }

      return json(await describeArtifact(artifact));
    },
  );
}
