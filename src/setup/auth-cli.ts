import { exec } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:https";
import { resolveCert } from "./certs.js";
import { AUTHORIZE_URL, CALLBACK_PORT, credentials, REDIRECT_URI } from "./config.js";
import { exchangeCode } from "../bungie/auth.js";

function openBrowser(url: string): void {
  const opener =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";

  exec(`${opener} "${url}"`);
}

function reply(body: string): string {
  return `<html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:2rem">${body}</body></html>`;
}

async function main(): Promise<void> {
  const { clientId } = credentials();
  const state = randomBytes(16).toString("hex");

  const authorizeUrl = `${AUTHORIZE_URL}?client_id=${clientId}&response_type=code&state=${state}`;
  const tls = resolveCert();

  await new Promise<void>((resolve, reject) => {
    const server = createServer({ key: tls.key, cert: tls.cert }, (request, response) => {
      const url = new URL(request.url ?? "/", REDIRECT_URI);

      if (url.pathname !== "/callback") {
        response.writeHead(404).end();
        return;
      }

      const code = url.searchParams.get("code");

      if (url.searchParams.get("state") !== state || !code) {
        response
          .writeHead(400)
          .end(reply("<h2>Auth failed.</h2><p>State mismatch or missing code.</p>"));
        server.close();
        reject(new Error("[destiny2-mcp] State mismatch or missing authorization code."));
        return;
      }

      exchangeCode(code)
        .then(() => {
          response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          response.end(
            reply(
              "<h2>Authenticated ✨</h2><p>You can close this tab and return to the terminal.</p>",
            ),
          );
          server.close();
          resolve();
        })
        .catch((error) => {
          response
            .writeHead(500)
            .end(reply(`<h2>Token exchange failed.</h2><pre>${String(error)}</pre>`));
          server.close();
          reject(error);
        });
    });

    server.listen(CALLBACK_PORT, "127.0.0.1", () => {
      console.log("[destiny2-mcp] Opening browser to log in to Bungie...");
      console.log(`[destiny2-mcp] If it doesn't open, visit:\n${authorizeUrl}`);
      if (!tls.trusted) {
        console.log(
          "[destiny2-mcp] Your browser will warn about a self-signed certificate — that is expected; proceed.",
        );
        console.log(
          "[destiny2-mcp] To remove that warning, install mkcert (https://github.com/FiloSottile/mkcert) and run `mkcert -install`.",
        );
      }
      openBrowser(authorizeUrl);
    });
  });

  console.log("[destiny2-mcp] Tokens saved. You're ready to use the MCP server.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
