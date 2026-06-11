import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerBuildTools } from "./tools/builds/index.js";
import { registerReadTools } from "./tools/read.js";
import { registerWriteTools } from "./tools/write.js";

const server = new McpServer({ name: "destiny2-mcp", version: "1.0.0" });

registerReadTools(server);
registerWriteTools(server);
registerBuildTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
