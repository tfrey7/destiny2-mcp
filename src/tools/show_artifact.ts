import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Component, getProfile } from "../bungie/profile.js";
import { describeArtifact, seasonalArtifact } from "./artifact.js";
import { artifactCard, json } from "./response.js";

export function registerShowArtifact(server: McpServer): void {
  server.registerTool(
    "show_artifact",
    {
      description:
        "Render the player's active seasonal artifact as a text card: each tier's perks listed with the chosen ones marked ●. Use this to show a player their artifact at a glance; pair with get_artifact for the perk descriptions.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const profile = await getProfile([Component.CharacterProgressions]);
      const artifact = seasonalArtifact(profile);

      if (!artifact) {
        return json({ error: "No seasonal artifact found on this account." });
      }

      return artifactCard(await describeArtifact(artifact));
    },
  );
}
