import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BungieError } from "../bungie/client.js";
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
      let response: unknown;

      try {
        response = await action("/Destiny2/Actions/Loadouts/SnapshotLoadout/", {
          characterId,
          loadoutIndex,
        });
      } catch (error) {
        // Bungie's SnapshotLoadout endpoint returns HTTP 500 / DestinyInvalidRequest (1622) while
        // serializing certain equipped states — notably the new Edge of Fate armor (gear tiers and the
        // stat-archetype "*Mod"/"Upgrade Armor" sockets). The request itself is well-formed: the sibling
        // ClearLoadout endpoint accepts the identical body. So this is an API-side failure the client
        // cannot work around — surface that plainly instead of Bungie's opaque "your request was invalid".
        if (error instanceof BungieError && error.errorStatus === "DestinyInvalidRequest") {
          throw new Error(
            "[destiny2-mcp] Bungie's SnapshotLoadout endpoint rejected the snapshot " +
              "(HTTP 500 / DestinyInvalidRequest). This is a known API-side failure serializing the " +
              "currently equipped gear (common with new Edge of Fate armor), not a problem with this " +
              "request — equipping and other loadout actions work. Save the loadout from the in-game " +
              "Loadouts menu instead; equip_loadout / show_loadout can then use the saved slot.",
          );
        }

        throw error;
      }

      return ok(
        `Snapshotted current gear into loadout ${loadoutIndex} on character ${characterId}.`,
        response,
      );
    },
  );
}
