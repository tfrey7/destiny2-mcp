import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { isOwned, ownedGear } from "../bungie/acquisition.js";
import { searchItems, type OwnershipLookup } from "../bungie/manifest.js";
import {
  classNameSchema,
  elementSchema,
  itemCategorySchema,
  sortSchema,
  tierSchema,
} from "../schemas.js";
import { json } from "./response.js";

export function registerSearchItems(server: McpServer): void {
  server.registerTool(
    "search_items",
    {
      description:
        "Search the full Destiny 2 item catalog (the manifest, not the player's inventory) by attribute. This is the authoritative, complete catalog: for any 'list all X' or 'what's the newest Y' question — every exotic Void weapon, every hand cannon, every piece of an armor set — query here. NEVER answer such questions from web search or memory; tier lists and recall miss reissues, omit brand-new items, and mislabel elements (the element is set by damage type, not the weapon's slot). Filter by any combination of name substring, element, item type (e.g. 'Trace Rifle'), rarity tier, armor set name, and category. Note: gear tier (the 1-5 scale) is per-instance, not a catalog attribute, so filter that with list_inventory instead. Pass sort:'newest' to order by most-recently-added first — the way to resolve 'the latest'/'the new' <type> (e.g. the newest exotic hand cannon); pair with limit:1 to pick just it. Pass owned:false to keep only gear the account has never acquired, or owned:true for gear it owns — ownership accounts for both held inventory and Collections, so it is the right signal for 'what am I missing' (don't diff inventory by hand). For armor, pass class (Warlock/Titan/Hunter) to keep only that class's gear plus class-agnostic pieces — the right way to narrow exotic armor to a single-class account. The cosmetic categories (shader, emblem, ornament, or cosmetic for all three) surface looks a player can apply; each result's itemHash is the plugItemHash for insert_plug (shaders/ornaments) or feeds how_to_acquire and inspect_item. The perk category covers weapon/armor perks, enhanced perks, origin traits, and intrinsic frames — search a perk or trait by name (e.g. 'Veist Stinger') to resolve its itemHash, then pass that hash to inspect_item to read what it does. REVERSE LOOKUPS: pass perk:'<name or itemHash>' to list every weapon/armor that can roll or insert that perk (e.g. perk:'Incandescent' → the guns that roll it) — the inverse of inspect_item, which goes item→perks. Pass setBonus:'<name>' to list every armor piece whose set grants that bonus, by the bonus perk's name or the set name (e.g. setBonus:'Supercyclical' → the Iron Battalion pieces) — this is how you answer 'how do I get this set bonus'. Both combine with the other filters (e.g. perk:'Incandescent' element:'Solar', or setBonus:'Supercyclical' class:'Hunter'). To show what a result looks like, pass its itemHash to show_item for the icon. Results cap at `limit` (default 50, max 200); `count` is the full match total and `truncated` flags more beyond the current page — pass `offset` to page through the rest (e.g. offset:200 for the next page).",
      inputSchema: {
        name: z.string().optional(),
        element: elementSchema.optional(),
        type: z.string().optional(),
        tier: tierSchema.optional(),
        set: z.string().optional(),
        category: itemCategorySchema.optional(),
        class: classNameSchema.optional(),
        perk: z.string().optional(),
        setBonus: z.string().optional(),
        owned: z.boolean().optional(),
        sort: sortSchema.optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (filters) => {
      let ownershipLookup: OwnershipLookup | undefined;

      if (filters.owned !== undefined) {
        const owned = await ownedGear();

        ownershipLookup = (entry) => isOwned(entry, owned);
      }

      const { count, truncated, items } = await searchItems(filters, ownershipLookup);
      const result = items.map((item) => ({
        name: item.name,
        tier: item.tier,
        type: item.type,
        element: item.element,
        slot: item.slot,
        ammoType: item.ammoType,
        classType: item.classType,
        set: item.setName,
        itemHash: item.hash,
        ...(filters.owned !== undefined && { owned: filters.owned }),
      }));

      return json({ count, truncated, items: result });
    },
  );
}
