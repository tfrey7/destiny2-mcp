import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { weaponKills } from "../bungie/weapon_stats.js";
import { json } from "./response.js";

export function registerWeaponKills(server: McpServer): void {
  server.registerTool(
    "weapon_kills",
    {
      description:
        "Rank the player's weapons by lifetime kills, aggregated across all characters (or one, with characterId). Answers questions like 'what SMG do I have the most kills with?', 'which hand cannon have I killed the most with?', or 'top 10 weapons by kills'. Each row resolves the weapon's name, type, element, and rarity from the manifest and reports total kills, precision kills, and the precision ratio (precision kills ÷ kills, recomputed from the summed totals). Filter by weapon type — abbreviations work (smg, hc, ar, lmg/mg, gl, rl, fusion, sniper, shotgun, pulse, scout, sidearm, bow, glaive, sword, trace) or any substring of the full type name — by element (Solar/Arc/Void/Stasis/Strand/Kinetic), and by name substring. Sort by 'kills' (default) or 'precision'; cap with limit (default 25). Only weapons the account has actually used appear — a weapon never fired simply won't be listed. Read-only; reflects live account state.",
      inputSchema: {
        type: z.string().optional(),
        element: z.string().optional(),
        name: z.string().optional(),
        characterId: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        sort: z.enum(["kills", "precision"]).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (options) => json(await weaponKills(options)),
  );
}
