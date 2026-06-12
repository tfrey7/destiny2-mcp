import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { action } from "./actions.js";
import { ok } from "./response.js";

export function registerSnapshotLoadout(server: McpServer): void {
  server.registerTool(
    "snapshot_loadout",
    {
      description:
        "Save the character's currently equipped gear into a loadout slot, overwriting whatever is in that slot.",
      inputSchema: {
        characterId: z.string(),
        loadoutIndex: z.number().int().min(0),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ characterId, loadoutIndex }) => {
      const response = await action("/Destiny2/Actions/Loadouts/SnapshotLoadout/", {
        characterId,
        loadoutIndex,
      });

      return ok(
        `Snapshotted current gear into loadout ${loadoutIndex} on character ${characterId}.`,
        response,
      );
    },
  );
}
