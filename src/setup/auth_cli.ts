import { runLogin } from "./login.js";

runLogin()
  .then(() => {
    console.log("[destiny2-mcp] Tokens saved. You're ready to use the MCP server.");
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
