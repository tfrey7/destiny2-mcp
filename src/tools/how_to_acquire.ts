import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { acquisitionFor, ownedGear } from "../bungie/acquisition.js";
import { findItemByName } from "../bungie/manifest.js";
import { json } from "./response.js";

export function registerHowToAcquire(server: McpServer): void {
  server.registerTool(
    "how_to_acquire",
    {
      description:
        "Look up how to acquire weapons or armor by name: the in-game source (activity, vendor, etc.), rarity, item type, and whether the account already owns it. Use this to tell the player where to find gear they are missing for a build.",
      inputSchema: { items: z.array(z.string()).min(1) },
    },
    async ({ items }) => {
      const owned = await ownedGear();
      const result = await Promise.all(
        items.map(async (name) => {
          const hash = await findItemByName(name);

          if (hash === undefined) {
            return { name, note: "No item with this exact name in the manifest." };
          }

          return acquisitionFor(hash, owned);
        }),
      );

      return json(result);
    },
  );
}
