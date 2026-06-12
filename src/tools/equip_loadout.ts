import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { action } from "./actions.js";
import { ok } from "./response.js";

export function registerEquipLoadout(server: McpServer): void {
  server.registerTool(
    "equip_loadout",
    {
      description:
        "Equip one of a character's saved in-game loadout slots. Find the loadoutIndex via list_loadouts.",
      inputSchema: {
        characterId: z.string(),
        loadoutIndex: z.number().int().min(0),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ characterId, loadoutIndex }) => {
      const response = await action("/Destiny2/Actions/Loadouts/EquipLoadout/", {
        characterId,
        loadoutIndex,
      });

      return ok(`Equipped loadout ${loadoutIndex} on character ${characterId}.`, response);
    },
  );
}
