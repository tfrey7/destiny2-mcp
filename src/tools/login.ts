import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runLogin } from "../setup/login.js";

export function registerLogin(server: McpServer): void {
  server.registerTool(
    "login",
    {
      description:
        "Authenticate with Bungie. Opens a browser to log in and authorize destiny2-mcp, then stores the OAuth tokens locally so the other tools can read your account. Run this once on first use, or again if a tool reports you are not authenticated.",
      inputSchema: {},
    },
    async () => {
      await runLogin();

      return {
        content: [
          { type: "text" as const, text: "Authenticated ✨ You're ready to use destiny2-mcp." },
        ],
      };
    },
  );
}
