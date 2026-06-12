import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BungieError } from "../bungie/client.js";
import { getProfile } from "../bungie/profile.js";
import { action, itemHashFor, transfer, TRANSFER_COMPONENTS } from "./actions.js";
import { ok } from "./response.js";

export function registerPullFromPostmaster(server: McpServer): void {
  server.registerTool(
    "pull_from_postmaster",
    {
      description:
        "Pull an item out of the Postmaster (uncollected mail) onto a character — the gap list_inventory's per-character `postmaster` array can't otherwise act on (e.g. a duplicate exotic stuck there). itemId is the item's instance id (from list_inventory's postmaster array); itemReferenceHash (the definition hash) is resolved from that instance automatically, so only pass it to override or for non-instanced stacks that have no instance id. Bungie only pulls onto the CHARACTER — it can't land straight in the vault — so set thenVault true to chain a character→vault transfer and move the item all the way to the vault in one call. This is a LIVE action: it only succeeds while the player is signed into the game (Bungie returns error 1623 / DestinyCannotPerformActionAtThisLocation otherwise), same as equipping.",
      inputSchema: {
        characterId: z.string(),
        itemId: z.string().optional(),
        itemReferenceHash: z.number().int().optional(),
        stackSize: z.number().int().min(1).default(1),
        thenVault: z.boolean().default(false),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ characterId, itemId, itemReferenceHash, stackSize, thenVault }) => {
      const profile = await getProfile(TRANSFER_COMPONENTS);
      const hash = itemReferenceHash ?? (itemId ? itemHashFor(profile, itemId) : undefined);

      if (hash === undefined) {
        throw new Error(
          itemId
            ? `[destiny2-mcp] No item with instance id ${itemId} found to resolve its definition hash; pass itemReferenceHash explicitly.`
            : "[destiny2-mcp] Pass itemId (for an instanced item) or itemReferenceHash (for a non-instanced stack) to identify what to pull.",
        );
      }

      if (thenVault && !itemId) {
        throw new Error(
          "[destiny2-mcp] thenVault needs an instanced itemId to transfer to the vault after pulling.",
        );
      }

      let response: unknown;

      try {
        response = await action("/Destiny2/Actions/Items/PullFromPostmaster/", {
          characterId,
          itemReferenceHash: hash,
          itemId,
          stackSize,
        });
      } catch (error) {
        if (
          error instanceof BungieError &&
          error.errorStatus === "DestinyCannotPerformActionAtThisLocation"
        ) {
          throw new Error(
            "[destiny2-mcp] Pulling from the Postmaster is a live action: it only works while you're signed into the game. " +
              "Bungie rejected it with DestinyCannotPerformActionAtThisLocation (1623) — launch Destiny 2 and try again.",
          );
        }

        throw error;
      }

      if (!thenVault) {
        return ok(
          `Pulled item ${itemId ?? hash} from the postmaster onto character ${characterId}.`,
          response,
        );
      }

      const vaultResponse = await transfer(characterId, itemId!, hash, true);

      return ok(
        `Pulled item ${itemId} from the postmaster and moved it to the vault.`,
        vaultResponse,
      );
    },
  );
}
