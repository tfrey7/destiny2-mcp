import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BungieError } from "../bungie/client.js";
import { isGearBucket, itemName } from "../bungie/manifest.js";
import { Component, getProfile } from "../bungie/profile.js";
import { transfer } from "./actions.js";
import { ok } from "./response.js";

export function registerVaultInventory(server: McpServer): void {
  server.registerTool(
    "vault_inventory",
    {
      description:
        "Move every unequipped weapon and armor piece off a character and into the vault, clearing the " +
        "character's carried gear in one call. Equipped gear, subclass, postmaster items, consumables, " +
        "and cosmetics (ghost, sparrow, ship, emblem) are left in place. Defaults to every character; " +
        "pass a characterId to clear just one. Transfers run one at a time and each item's outcome is " +
        "reported, so a full vault or an untransferable item fails only that item, not the whole batch.",
      inputSchema: {
        characterId: z.string().optional(),
      },
    },
    async ({ characterId }) => {
      const profile = await getProfile([Component.Characters, Component.CharacterInventories]);
      const inventories = profile.characterInventories?.data ?? {};
      const entries = Object.entries(inventories).filter(
        ([id]) => !characterId || id === characterId,
      );

      // Sequential, not parallel: every transfer writes to the one vault, and Bungie throttles
      // concurrent item actions — a burst would draw ThrottleLimitExceeded rather than finish faster.
      const results: { characterId: string; item: string; status: string; reason?: string }[] = [];
      let vaulted = 0;

      for (const [id, bucket] of entries) {
        for (const item of bucket.items) {
          if (!item.itemInstanceId || !isGearBucket(item.bucketHash)) {
            continue;
          }

          const name = await itemName(item.itemHash);

          try {
            await transfer(id, item.itemInstanceId, item.itemHash, true);
            vaulted += 1;
            results.push({ characterId: id, item: name, status: "vaulted" });
          } catch (error) {
            const reason = error instanceof BungieError ? error.errorStatus : String(error);

            results.push({ characterId: id, item: name, status: "failed", reason });
          }
        }
      }

      const scope = characterId ? `character ${characterId}` : "all characters";
      const failures = results.length - vaulted;

      return ok(
        `Vaulted ${vaulted} unequipped item(s) from ${scope}${failures ? `; ${failures} failed.` : "."}`,
        results,
      );
    },
  );
}
