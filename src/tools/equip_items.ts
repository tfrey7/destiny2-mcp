import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getGearProfile } from "../bungie/profile.js";
import { equipGear } from "./equip_core.js";
import { ok } from "./response.js";

export function registerEquipItems(server: McpServer): void {
  server.registerTool(
    "equip_items",
    {
      description:
        "Equip several items on a character at once by their item instance ids — the whole loadout in one " +
        "call. Each item is moved onto the character automatically if it sits in the vault or on another " +
        "character, so no transfer_item calls are needed first. Exotics are equipped last so trading one " +
        "exotic for another doesn't trip the one-exotic limit mid-swap, and any piece that couldn't be " +
        "moved or equipped is reported by name rather than sinking the rest. A full destination bucket is " +
        "cleared by bumping a duplicate of the same item to the vault; otherwise that piece reports the " +
        "bucket is full. To also set subclass plugs and armor mods in the same call, use equip_build.",
      inputSchema: {
        characterId: z.string(),
        itemIds: z.array(z.string()).min(1),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ characterId, itemIds }) => {
      const profile = await getGearProfile();
      const { results, notes, liveActionRequired } = await equipGear(profile, characterId, itemIds);

      const failed = results.filter((result) => result.status === "failed");
      const live = liveActionRequired
        ? " Sign into Destiny 2 and retry — equipping only works while you're in-game."
        : "";

      const message = failed.length
        ? `${notes}Equipped ${results.length - failed.length} of ${results.length} item(s) on character ` +
          `${characterId}. These did not equip: ` +
          failed.map((result) => `${result.name} (${result.reason})`).join(", ") +
          `.${live}`
        : `${notes}Equipped ${results.length} item(s) on character ${characterId}.`;

      return ok(message, { results, liveActionRequired });
    },
  );
}
