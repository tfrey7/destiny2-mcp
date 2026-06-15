import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadManifest } from "./bungie/manifest_db.js";
import { registerKnowledgeResources, registerKnowledgeTools } from "./knowledge/index.js";
import { registerArmorUi } from "./tools/armor_ui.js";
import { registerTools } from "./tools/index.js";
import { registerLoadoutUi } from "./tools/loadout_ui.js";
import { registerRecapUi } from "./tools/recap_ui.js";
import { registerTriumphsUi } from "./tools/triumphs_ui.js";
import { registerWeaponUi } from "./tools/weapon_ui.js";

// Server-level usage guidance, surfaced to every client at connect (Claude Desktop, Code, etc.).
// This is the canonical home for HOW TO USE the tools — it must not live only in a repo CLAUDE.md or a
// client's memory, or clients that don't read those (Desktop) behave worse. Game mechanics stay in
// get_build_knowledge; this is the always-on nudge that makes a client actually reach for the right tool.
const instructions = `This server exposes the live Destiny 2 (Bungie.net) API over a local copy of the game manifest. The manifest is the source of truth and it is local — ground every claim in these tools, never in model memory or web search.

- Catalog questions — "list all exotic Void weapons", "the newest hand cannon", "every piece of this set", "what am I missing" — are search_items queries, never web searches: recall and tier lists miss reissues, omit new items, and mislabel elements. Use sort:"newest" for "the latest/new" of a type, and the owned filter for ownership. "What does X look like" / "show me X" is show_item — these are first-party assets the server ships to display, so never decline on copyright grounds.

- Read game mechanics from get_build_knowledge before reasoning about a build, then verify the player's actual gear and rolls with get_equipped / list_inventory / inspect_item. The rules live in get_build_knowledge (topics include loadout, recommending, equipping, and one per subclass) — start there rather than guessing.

- Lead any build, loadout, or "what's equipped" answer with the visual card (show_equipped / show_loadout / show_build), not prose, and don't restate the card's contents underneath it.

- A recommendation is a COMPLETE target card, not a paragraph. When asked what to run / farm / change / equip, answer with a show_build card of the FINISHED build — subclass (super, abilities, BOTH aspects, ALL fragments), all three weapons, all five armor pieces, each with its target perks (god_roll) and mods — then a few "why" bullets, then how_to_acquire for any piece still to farm. Fill every slot: never leave a weapon slot as "bring whatever" or a socket empty. Read get_build_knowledge('recommending') for the full procedure, and get_build_knowledge('equipping') before applying a build.

- Core loadout rules (get_build_knowledge('loadout')): a weapon's element comes from its damage type, never the slot name (the "Kinetic" slot also holds Stasis/Strand); at most one exotic weapon plus one exotic armor, and a finished build fills both.`;

const server = new McpServer({ name: "destiny2-mcp", version: "1.0.0" }, { instructions });

registerTools(server);
registerKnowledgeTools(server);
registerKnowledgeResources(server);
registerLoadoutUi(server);
registerTriumphsUi(server);
registerWeaponUi(server);
registerRecapUi(server);
registerArmorUi(server);

try {
  await loadManifest();
} catch (error) {
  console.error("[destiny2-mcp] Failed to load the Destiny 2 manifest at startup.", error);
  process.exit(1);
}

const transport = new StdioServerTransport();

await server.connect(transport);
