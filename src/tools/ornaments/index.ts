import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { classNameSchema } from "../../schemas.js";
import { json } from "../response.js";
import { findOrnaments } from "./logic.js";

const slotSchema = z.enum(["helmet", "arms", "chest", "legs", "class"]);

export function registerFindOrnaments(server: McpServer): void {
  server.registerTool(
    "find_ornaments",
    {
      description:
        "Find universal armor ornaments by how they LOOK — the aesthetic search the manifest can't do, " +
        "since every ornament's text is identical boilerplate. Pass a vibe ('cowboy', 'skeleton', " +
        "'robot', 'glowing blue knight') and get back matching ornaments ranked by fit, each with the " +
        "plugItemHash to apply. Every ornament is vision-captioned natively for its own class, so pass " +
        "class=Warlock/Hunter/Titan (defaults to Warlock) to search that class's actual pieces — there is " +
        "no cross-class guessing. Each result carries crossClass: false means the set is exclusive to that " +
        "class (no equivalent on the others). To apply a result: inspect_sockets on the target equipped " +
        "armor piece to get its ornament socketIndex and confirm the plug is unlocked, then insert_plug " +
        "with this plugItemHash.",
      inputSchema: {
        query: z.string(),
        class: classNameSchema.optional(),
        slot: slotSchema.optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, class: className, slot, limit }) => {
      const resolvedClass = className ?? "Warlock";
      const ornaments = await findOrnaments(query, {
        className: resolvedClass,
        slot,
        limit: limit ?? 12,
      });

      return json({ class: resolvedClass, query, count: ornaments.length, ornaments });
    },
  );
}
