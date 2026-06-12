import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { action } from "./actions.js";
import { ok } from "./response.js";

export function registerUpdateLoadoutIdentifiers(server: McpServer): void {
  server.registerTool(
    "update_loadout_identifiers",
    {
      description:
        "Change a loadout's name, color, or icon. Values are manifest hashes (DestinyLoadout{Name,Color,Icon}Definition).",
      inputSchema: {
        characterId: z.string(),
        loadoutIndex: z.number().int().min(0),
        nameHash: z.number().int().optional(),
        colorHash: z.number().int().optional(),
        iconHash: z.number().int().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ characterId, loadoutIndex, nameHash, colorHash, iconHash }) => {
      const response = await action("/Destiny2/Actions/Loadouts/UpdateLoadoutIdentifiers/", {
        characterId,
        loadoutIndex,
        nameHash,
        colorHash,
        iconHash,
      });

      return ok(
        `Updated identifiers for loadout ${loadoutIndex} on character ${characterId}.`,
        response,
      );
    },
  );
}
