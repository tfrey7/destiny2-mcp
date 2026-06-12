import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { clearTokens } from "../bungie/auth.js";

export function registerLogout(server: McpServer): void {
  server.registerTool(
    "logout",
    {
      description:
        "Log out of Bungie by deleting the locally stored OAuth tokens. The other tools will report you are not authenticated until you run `login` again. This does not revoke the tokens on Bungie's side — remove the app under your Bungie.net authorized apps to do that.",
      inputSchema: {},
    },
    async () => {
      const wasAuthenticated = await clearTokens();

      return {
        content: [
          {
            type: "text" as const,
            text: wasAuthenticated
              ? "Logged out 👋 Your stored tokens were deleted. Run `login` to authenticate again."
              : "You were not logged in — there were no stored tokens to delete.",
          },
        ],
      };
    },
  );
}
