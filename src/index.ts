import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadManifest } from "./bungie/manifest.js";
import { registerKnowledgeTools } from "./knowledge/index.js";
import { registerTools } from "./tools/index.js";

const server = new McpServer({ name: "destiny2-mcp", version: "1.0.0" });

registerTools(server);
registerKnowledgeTools(server);

try {
  await loadManifest();
} catch (error) {
  console.error("[destiny2-mcp] Failed to load the Destiny 2 manifest at startup.", error);
  process.exit(1);
}

const transport = new StdioServerTransport();

await server.connect(transport);
