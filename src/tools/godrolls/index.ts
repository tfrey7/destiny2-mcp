import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findItemByName, itemName } from "../../bungie/manifest.js";
import { json } from "../response.js";
import { godRollsFor, nameColumns, namePerks } from "./logic.js";

export function registerGodRoll(server: McpServer): void {
  server.registerTool(
    "god_roll",
    {
      description:
        "Look up the community god roll(s) for a weapon — the perk combinations top theorycrafters " +
        "recommend, compiled from the DIM wishlist. Pass a weapon name (resolved via the manifest) or " +
        "its itemHash. Returns each recommended roll with a label and PvE/PvP tags, its accepted perks " +
        "per column (barrel, magazine, then the trait columns that define the roll), and any perks the " +
        "community flags as trash. Use this to answer 'what's the god roll for X' and to know which perks " +
        "to chase; to judge a roll the player actually owns, inspect_item on its instance reports how the " +
        "equipped perks measure up. Covers Legendary weapons with random rolls, not exotics or fixed rolls.",
      inputSchema: {
        weapon: z.string().optional(),
        itemHash: z.number().int().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ weapon, itemHash }) => {
      const hash = itemHash ?? (weapon ? await findItemByName(weapon) : undefined);

      if (hash === undefined) {
        throw new Error(
          weapon
            ? `[destiny2-mcp] No weapon named "${weapon}" in the manifest.`
            : "[destiny2-mcp] god_roll requires a weapon name or itemHash.",
        );
      }

      const found = await godRollsFor(hash);

      if (!found) {
        return json({
          itemHash: hash,
          name: await itemName(hash),
          covered: false,
          message: "No community god roll on file for this weapon (not in the DIM wishlist).",
        });
      }

      const rolls = await Promise.all(
        found.rolls.map(async (roll) => ({
          label: roll.label,
          tags: roll.tags,
          columns: await nameColumns(roll.columns),
        })),
      );

      return json({
        itemHash: hash,
        name: found.name,
        type: found.type,
        covered: true,
        rolls,
        trash: await namePerks(found.trash),
      });
    },
  );
}
