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

const server = new McpServer({ name: "destiny2-mcp", version: "1.0.0" });

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
